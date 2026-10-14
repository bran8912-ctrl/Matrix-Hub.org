// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IQuickSwapV2Router
 * @author Matrix-Hub Team
 * @notice Minimal interface for the QuickSwap V2 router functions used here.
 */
interface IQuickSwapV2Router {
    /// @notice Returns the wrapped native token address used by the router.
    /// @return Wrapped native token address.
    function WETH() external view returns (address);

    /// @notice Adds token/native liquidity and returns the amounts used and LP minted.
    /// @param token ERC-20 token to pair with the native asset.
    /// @param amountTokenDesired Maximum ERC-20 amount to add.
    /// @param amountTokenMin Minimum ERC-20 amount accepted.
    /// @param amountETHMin Minimum native amount accepted.
    /// @param to Recipient of the LP tokens.
    /// @param deadline Latest timestamp at which the operation is valid.
    /// @return amountToken ERC-20 amount added.
    /// @return amountETH Native amount added.
    /// @return liquidity Amount of LP tokens minted.
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

/**
 * @title LiquidityRouter
 * @author Matrix-Hub Team
 * @notice Queues casino MTX fees and adds MTX/WMATIC liquidity through QuickSwap V2.
 * @dev CasinoCore deposits MTX; the owner supplies MATIC separately when providing liquidity.
 */
contract LiquidityRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidContract();
    error NotCasinoCore();
    error NotQuickSwapRouter();
    error InsufficientPendingMTX();
    error Expired();
    error NativeTransferFailed();

    /// @notice MTX token collected from CasinoCore.
    IERC20 public immutable MTX;

    /// @notice QuickSwap V2 Router02 contract.
    IQuickSwapV2Router public immutable QUICKSWAP_V2_ROUTER;

    /// @notice Wrapped native asset used by QuickSwap V2.
    address public immutable WRAPPED_NATIVE;

    /// @notice CasinoCore authorized to deposit MTX fees.
    address public casinoCore;

    /// @notice MTX queued for a future liquidity provision.
    uint256 public pendingMtx;

    /// @notice Emitted when the authorized CasinoCore address changes.
    /// @param previousCore Previous CasinoCore address.
    /// @param newCore New CasinoCore address.
    event CasinoCoreUpdated(address indexed previousCore, address indexed newCore);

    /// @notice Emitted when CasinoCore deposits MTX for liquidity.
    /// @param amount Amount of MTX deposited.
    event LiquidityDeposited(uint256 amount);

    /// @notice Emitted when the owner queues MTX for initial liquidity.
    /// @param amount Amount of MTX queued.
    event InitialLiquidityQueued(uint256 amount);

    /// @notice Emitted when MTX/WMATIC liquidity is provided.
    /// @param provider Owner who called the function and supplied MATIC.
    /// @param lpRecipient Address receiving LP tokens.
    /// @param amountMtx Amount of MTX added.
    /// @param amountMatic Amount of MATIC added.
    /// @param liquidity Amount of LP tokens minted.
    event LiquidityProvided(
        address indexed provider,
        address indexed lpRecipient,
        uint256 amountMtx,
        uint256 amountMatic,
        uint256 liquidity
    );

    /// @notice Emitted when queued MTX is withdrawn by the owner.
    /// @param recipient Address receiving MTX.
    /// @param amount Amount of MTX withdrawn.
    event PendingMtxWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotCasinoCore();
        _;
    }

    constructor(address _mtx, address _quickSwapRouter) Ownable(msg.sender) {
        if (_mtx == address(0) || _quickSwapRouter == address(0)) revert ZeroAddress();
        if (_mtx.code.length == 0 || _quickSwapRouter.code.length == 0) revert InvalidContract();

        address _wrappedNative = IQuickSwapV2Router(_quickSwapRouter).WETH();
        if (_wrappedNative == address(0)) revert ZeroAddress();
        if (_wrappedNative.code.length == 0) revert InvalidContract();

        MTX = IERC20(_mtx);
        QUICKSWAP_V2_ROUTER = IQuickSwapV2Router(_quickSwapRouter);
        WRAPPED_NATIVE = _wrappedNative;
    }

    /// @notice Accepts native refunds from QuickSwap V2 during liquidity provision.
    receive() external payable {
        if (msg.sender != address(QUICKSWAP_V2_ROUTER)) revert NotQuickSwapRouter();
    }

    /// @notice Set or replace the CasinoCore allowed to deposit MTX fees.
    /// @param _casinoCore New CasinoCore address.
    function setCasinoCore(address _casinoCore) external onlyOwner {
        if (_casinoCore == address(0)) revert ZeroAddress();
        if (_casinoCore.code.length == 0) revert InvalidContract();

        address previousCore = casinoCore;
        casinoCore = _casinoCore;
        emit CasinoCoreUpdated(previousCore, _casinoCore);
    }

    /// @notice Account for MTX already transferred here by CasinoCore.
    /// @param amount Amount of MTX deposited for future liquidity provision.
    function depositLiquidity(uint256 amount) external onlyCasinoCore {
        if (amount == 0) revert ZeroAmount();
        if (MTX.balanceOf(address(this)) < pendingMtx + amount) revert InsufficientPendingMTX();

        pendingMtx += amount;
        emit LiquidityDeposited(amount);
    }

    /// @notice Transfer owner-supplied MTX into the queue to bootstrap the first pool.
    /// @param amount Amount of MTX to queue for liquidity.
    function queueInitialLiquidity(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        MTX.safeTransferFrom(msg.sender, address(this), amount);
        pendingMtx += amount;
        emit InitialLiquidityQueued(amount);
    }

    /**
     * @notice Add queued MTX and caller-supplied MATIC to the QuickSwap V2 pool.
     * @dev Any unused MTX stays pending; unused MATIC is returned to the caller.
     * @param amountMtxDesired Maximum pending MTX amount to add.
     * @param amountMtxMin Minimum MTX amount accepted by QuickSwap.
     * @param amountMaticMin Minimum MATIC amount accepted by QuickSwap.
     * @param deadline Latest timestamp at which the operation is valid.
     * @return amountMtx MTX amount actually added.
     * @return amountMatic MATIC amount actually added.
     * @return liquidity Amount of LP tokens minted.
     */
    function provideLiquidity(
        uint256 amountMtxDesired,
        uint256 amountMtxMin,
        uint256 amountMaticMin,
        uint256 deadline
    )
        external
        payable
        onlyOwner
        nonReentrant
        returns (uint256 amountMtx, uint256 amountMatic, uint256 liquidity)
    {
        if (amountMtxDesired == 0 || msg.value == 0) revert ZeroAmount();
        if (deadline < block.timestamp) revert Expired();
        if (amountMtxDesired > pendingMtx) revert InsufficientPendingMTX();

        uint256 balanceBefore = address(this).balance - msg.value;
        pendingMtx -= amountMtxDesired;
        MTX.forceApprove(address(QUICKSWAP_V2_ROUTER), amountMtxDesired);

        (amountMtx, amountMatic, liquidity) = QUICKSWAP_V2_ROUTER.addLiquidityETH{value: msg.value}(
            address(MTX),
            amountMtxDesired,
            amountMtxMin,
            amountMaticMin,
            msg.sender,
            deadline
        );

        MTX.forceApprove(address(QUICKSWAP_V2_ROUTER), 0);
        pendingMtx += amountMtxDesired - amountMtx;

        uint256 unusedMatic = address(this).balance - balanceBefore;
        if (unusedMatic > 0) {
            (bool refunded,) = payable(msg.sender).call{value: unusedMatic}("");
            if (!refunded) revert NativeTransferFailed();
        }

        emit LiquidityProvided(msg.sender, msg.sender, amountMtx, amountMatic, liquidity);
    }

    /// @notice Recover queued MTX without adding liquidity.
    /// @param recipient Address receiving the withdrawn MTX.
    /// @param amount Amount of pending MTX to withdraw.
    function withdrawPendingMtx(address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > pendingMtx) revert InsufficientPendingMTX();

        pendingMtx -= amount;
        MTX.safeTransfer(recipient, amount);
        emit PendingMtxWithdrawn(recipient, amount);
    }
}
