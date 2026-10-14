// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CasinoReserve
 * @author Matrix-Hub Team
 * @notice Holds MTX reserves for casino payouts on Polygon
 * @dev Manages reserve balance and payout distribution
 */
contract CasinoReserve {
    using SafeERC20 for IERC20;

    // Custom errors for gas efficiency
    error NotAuthorized();
    error InsufficientReserve();
    error MTXTransferFailed();
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsReserveCap();

    /// @notice Emitted when the owner provides initial reserve funding.
    /// @param amount Amount of MTX added to the reserve.
    event ReserveFunded(uint256 amount);

    /// @notice MTX token contract
    IERC20 public mtx;
    
    /// @notice Current reserve balance
    uint256 public reserveBalance;
    
    /// @notice Maximum reserve capacity
    uint256 public reserveCap;
    
    /// @notice CasinoCore contract address
    address public casinoCore;

    /// @notice Owner address for administrative functions
    address public owner;

    /**
     * @notice Modifier to restrict access to CasinoCore only
     */
    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotAuthorized();
        _;
    }

    /**
     * @notice Constructor initializes reserve with MTX token address
     * @dev Sets up reserve parameters and CasinoCore integration
     * @param _mtx Address of deployed MatrixHubCoin (MTX) ERC-20 contract on Polygon
     * @param _reserveCap Maximum reserve capacity in MTX
     * @param _casinoCore Address of CasinoCore contract
     */
    constructor(address _mtx, uint256 _reserveCap, address _casinoCore) {
        if (_mtx == address(0)) revert ZeroAddress();
        if (_reserveCap == 0) revert ZeroAmount();
        mtx = IERC20(_mtx); // MTX Token address on Polygon - set from deployed MatrixHubCoin
        reserveCap = _reserveCap;
        casinoCore = _casinoCore; // can be address(0) — set later via setCasinoCore
        owner = msg.sender;
    }

    /**
     * @notice Update the CasinoCore address (owner only)
     * @dev Used to resolve circular deployment dependency
     * @param _casinoCore New CasinoCore contract address
     */
    function setCasinoCore(address _casinoCore) external {
        if (msg.sender != owner) revert NotAuthorized();
        if (_casinoCore == address(0)) revert ZeroAddress();
        casinoCore = _casinoCore;
    }

    /**
     * @notice Deposit MTX coins to reserve
     * @dev Only callable by CasinoCore, enforces reserve cap
     * @param amount Amount of MTX to deposit
     */
    function deposit(uint256 amount) external onlyCasinoCore {
        if (amount == 0) revert ZeroAmount();
        _recordDeposit(amount);
    }

    /**
     * @notice Fund the reserve before the casino begins accepting bets.
     * @dev Pulls MTX from the owner and updates the tracked reserve balance.
     * @param amount Amount of MTX to add to the reserve.
     */
    function fund(uint256 amount) external {
        if (msg.sender != owner) revert NotAuthorized();
        if (amount == 0) revert ZeroAmount();

        _recordDeposit(amount);
        mtx.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(amount);
    }

    /**
     * @notice Pay winner in MTX coins
     * @dev Only callable by CasinoCore
     * @param player Address of the player to pay
     * @param amount Amount of MTX to pay
     */
    function payWinner(address player, uint256 amount) external onlyCasinoCore {
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (reserveBalance < amount) revert InsufficientReserve();
        reserveBalance -= amount;
        if (!mtx.transfer(player, amount)) revert MTXTransferFailed();
    }

    /**
     * @notice Check reserve health
     * @dev Returns current reserve balance
     * @return Current reserve balance
     */
    function reserveHealth() external view returns (uint256) {
        return reserveBalance;
    }

    function _recordDeposit(uint256 amount) private {
        if (reserveBalance + amount > reserveCap) revert ExceedsReserveCap();
        reserveBalance += amount;
    }
}
