#!/usr/bin/env node
// Standalone Polygonscan verification — no file reading, no CORS
// Run: node scripts/verify_standalone.js
// Uses fetch() (available in Remix browser & Node 18+)

const POLYGONSCAN_API_KEY = "6557EZETIUE788YEH43FVETKI481MFNAZR";
const API_URL = "https://api.polygonscan.com/api";
const DEPLOYER = "0x9fb4bb44d8d962d695fc93b3dc15f1b287391077";
const MTX = "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a";

// ============================================================
// All source code embedded inline (no fs, no CORS)
// ============================================================

const MATRIX_HUB_COIN_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 Matrix-HubCoin (MTX)
  Utility token for the Matrix-Hub ecosystem on Polygon.
  Direct MATIC→MTX mint for easy onboarding.
  No taxes. Owner can pause minting.
  
  Network: Polygon Mainnet (Chain ID: 137)
  Token Standard: ERC-20
  Initial Owner: 0x9fb4bb44d8d962d695fc93b3dc15f1b287391077
  
  Audit Trail: Standard OpenZeppelin ERC20 implementation with owner-controlled minting
  Security: Auditable, transparent, and follows best practices
*/

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.${"so"}l";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.${"so"}l";

/**
 * @title MatrixHubCoin
 * @author Matrix-Hub Team
 * @notice ERC-20 utility token for the Matrix-Hub ecosystem on Polygon
 * @dev Implements direct MATIC→MTX minting with owner-controlled parameters
 */
contract MatrixHubCoin is ERC20, Ownable {
    // Custom errors for gas efficiency
    error ZeroAddress();
    error ZeroAmount();
    error MintingIsPaused();
    error ExceedsMaxSupply();
    error InvalidRate();
    error WithdrawalFailed();
    error NoMATICToWithdraw();
    /// @notice Maximum supply fixed at deployment
    uint256 public immutable MAX_SUPPLY;
    
    /// @notice Fixed exchange rate: 1 MATIC = maticToMtxRate MTX (can be adjusted by owner)
    uint256 public maticToMtxRate = 1000;
    
    /// @notice Minting can be paused by owner (e.g., when transitioning to DEX-only)
    bool public mintingPaused = false;
    
    /// @notice Emitted when MTX is purchased with MATIC
    /// @param buyer Address of the buyer
    /// @param maticAmount Amount of MATIC spent
    /// @param mtxAmount Amount of MTX received
    event MTXPurchased(address indexed buyer, uint256 indexed maticAmount, uint256 indexed mtxAmount);
    
    /// @notice Emitted when the exchange rate is updated
    /// @param newRate New exchange rate
    event RateUpdated(uint256 indexed newRate);
    
    /// @notice Emitted when minting is paused or unpaused
    /// @param paused True if minting is paused, false otherwise
    event MintingPaused(bool indexed paused);
    
    /// @notice Emitted when MATIC is withdrawn from the contract
    /// @param recipient Address receiving the MATIC
    /// @param amount Amount of MATIC withdrawn
    event Withdrawal(address indexed recipient, uint256 indexed amount);

    constructor(uint256 maxSupply, address initialOwner) ERC20("Matrix-HubCoin", "MTX") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (maxSupply == 0) revert ZeroAmount();
        MAX_SUPPLY = maxSupply * 10 ** decimals();
    }

    function buyMTX() external payable {
        _buyMTXInternal();
    }
    
    receive() external payable {
        _buyMTXInternal();
    }
    
    function _buyMTXInternal() private {
        if (mintingPaused) revert MintingIsPaused();
        if (msg.value == 0) revert ZeroAmount();
        
        uint256 mtxAmount = (msg.value * maticToMtxRate * 10 ** decimals()) / 1 ether;
        
        if (totalSupply() + mtxAmount > MAX_SUPPLY) revert ExceedsMaxSupply();
        
        _mint(msg.sender, mtxAmount);
        
        emit MTXPurchased(msg.sender, msg.value, mtxAmount);
    }
    
    function setMaticToMtxRate(uint256 newRate) external onlyOwner {
        if (newRate == 0) revert InvalidRate();
        maticToMtxRate = newRate;
        emit RateUpdated(newRate);
    }
    
    function setMintingPaused(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPaused(paused);
    }
    
    function withdrawMATIC(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoMATICToWithdraw();
        
        (bool success, ) = recipient.call{value: balance}("");
        if (!success) revert WithdrawalFailed();
        
        emit Withdrawal(recipient, balance);
    }

    function mintToEcosystem(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        
        _mint(to, amount);
        emit MTXPurchased(to, 0, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}`;

const CASINO_RESERVE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.${"so"}l";

/**
 * @title CasinoReserve
 * @author Matrix-Hub Team
 * @notice Holds MTX reserves for casino payouts on Polygon
 * @dev Manages reserve balance and payout distribution
 */
contract CasinoReserve {
    error NotAuthorized();
    error InsufficientReserve();
    error MTXTransferFailed();
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsReserveCap();

    IERC20 public mtx;
    uint256 public reserveBalance;
    uint256 public reserveCap;
    address public casinoCore;
    address public owner;

    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotAuthorized();
        _;
    }

    constructor(address _mtx, uint256 _reserveCap, address _casinoCore) {
        if (_mtx == address(0)) revert ZeroAddress();
        if (_reserveCap == 0) revert ZeroAmount();
        mtx = IERC20(_mtx);
        reserveCap = _reserveCap;
        casinoCore = _casinoCore;
        owner = msg.sender;
    }

    function setCasinoCore(address _casinoCore) external {
        if (msg.sender != owner) revert NotAuthorized();
        if (_casinoCore == address(0)) revert ZeroAddress();
        casinoCore = _casinoCore;
    }

    function deposit(uint256 amount) external onlyCasinoCore {
        if (amount == 0) revert ZeroAmount();
        if (reserveBalance + amount > reserveCap) revert ExceedsReserveCap();
        reserveBalance += amount;
    }

    function payWinner(address player, uint256 amount) external onlyCasinoCore {
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (reserveBalance < amount) revert InsufficientReserve();
        reserveBalance -= amount;
        if (!mtx.transfer(player, amount)) revert MTXTransferFailed();
    }

    function reserveHealth() external view returns (uint256) {
        return reserveBalance;
    }
}`;

const RNG_ENGINE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RNGEngine
 * @author Matrix-Hub Team
 * @notice Provably fair random number generator for casino games on Polygon
 * @dev Uses server seed commitment and client seed for verifiable randomness
 */
contract RNGEngine {
    error NotAuthorized();
    error ClientSeedNotSet();

    bytes32 public serverSeedHash;
    bytes32 public clientSeed;
    uint256 public nonce;
    address public casinoCore;
    address public owner;

    constructor(address _casinoCore) {
        casinoCore = _casinoCore;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotAuthorized();
        _;
    }

    function setClientSeed(bytes32 _clientSeed) external {
        clientSeed = _clientSeed;
    }

    function commitServerSeed(bytes32 hash) external onlyOwner {
        serverSeedHash = hash;
    }

    function resolve(bytes calldata gameData) external onlyCasinoCore returns (bool) {
        if (clientSeed == bytes32(0)) revert ClientSeedNotSet();
        bytes32 result = keccak256(abi.encodePacked(serverSeedHash, clientSeed, nonce, gameData));
        ++nonce;
        return interpretResult(result);
    }

    function setCasinoCore(address _casinoCore) external onlyOwner {
        if (_casinoCore == address(0)) revert NotAuthorized();
        casinoCore = _casinoCore;
    }

    function revealServerSeed(bytes32 seed) external view returns (bool) {
        return keccak256(abi.encodePacked(seed)) == serverSeedHash;
    }

    function interpretResult(bytes32 result) internal pure returns (bool) {
        return uint256(result) % 2 == 0;
    }
}`;

const LIQUIDITY_ROUTER_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.${"so"}l";

/**
 * @title LiquidityRouter
 * @author Matrix-Hub Team
 * @notice Manages liquidity for MTX/MATIC pool on Polygon DEX (QuickSwap)
 * @dev Routes liquidity to DEX pool
 */
contract LiquidityRouter {
    error MTXTransferFromFailed();
    error ZeroAddress();
    error ZeroAmount();

    IERC20 public mtx;
    address public dexPool;

    constructor(address _mtx, address _dexPool) {
        if (_mtx == address(0)) revert ZeroAddress();
        if (_dexPool == address(0)) revert ZeroAddress();
        mtx = IERC20(_mtx);
        dexPool = _dexPool;
    }

    function addLiquidity(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!mtx.transferFrom(msg.sender, dexPool, amount)) revert MTXTransferFromFailed();
    }
}`;

const CASINO_CORE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.${"so"}l";

interface ILiquidityRouter {
    function addLiquidity(uint256 amount) external;
}

interface ICasinoReserve {
    function deposit(uint256 amount) external;
    function payWinner(address to, uint256 amount) external;
    function reserveHealth() external view returns (uint256);
}

interface IRNGEngine {
    function resolve(bytes calldata gameData) external returns (bool);
}

contract CasinoCore {
    error NotGovernance();
    error BetBelowMinimum();
    error BetAboveMaximum();
    error TransferFailed();
    error InvalidPercentageSum();
    error DevPaymentFailed();
    error ZeroAddress();
    error CasinoPaused();
    error ExceedsMaxPayout();
    error MaxPayoutExceedsReserve();
    error TooManyBetsInBlock();
    error InvalidMultiplier();
    error InvalidBetLimit();
    error NotContract(address);
    error ZeroAmount();

    event BetPlaced(address indexed player, uint256 indexed amount, bytes gameData);
    event BetResolved(address indexed player, uint256 indexed amount, bool win, uint256 payout);
    event PercentagesUpdated(uint256 payout, uint256 liquidity, uint256 reserve, uint256 dev);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event PayoutMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    event MaxPayoutUpdated(uint256 oldMaxPayout, uint256 newMaxPayout);
    event PauseChanged(bool paused);
    event MaxBetsPerBlockUpdated(uint256 oldLimit, uint256 newLimit);

    IERC20 public mtx;
    ILiquidityRouter public liquidity;
    ICasinoReserve public reserve;
    IRNGEngine public rng;

    uint256 public payoutPercent = 88;
    uint256 public liquidityPercent = 6;
    uint256 public reservePercent = 4;
    uint256 public devPercent = 2;

    uint256 public payoutMultiplierBps = 19000;
    uint256 public maxPayoutPerBet;
    uint256 public minBet;
    uint256 public maxBet;
    address public dev;
    address public governance;
    bool public paused;
    uint256 public maxBetsPerBlock = 3;
    mapping(address => mapping(uint256 => uint256)) private _betsInBlock;
    uint256 public totalBets;
    uint256 public totalWagered;
    uint256 public totalPayout;
    uint256 public houseProfit;

    uint256 private constant BPS_DENOMINATOR = 10000;

    constructor(
        address _mtx,
        address _liquidity,
        address _reserve,
        address _rng,
        uint256 _minBet,
        uint256 _maxBet,
        uint256 _maxPayoutPerBet,
        address _dev,
        address _governance
    ) {
        if (
            _mtx == address(0) ||
            _liquidity == address(0) ||
            _reserve == address(0) ||
            _rng == address(0) ||
            _dev == address(0) ||
            _governance == address(0)
        ) revert ZeroAddress();

        if (_minBet == 0 || _maxBet == 0 || _minBet > _maxBet) revert InvalidBetLimit();
        if (_maxPayoutPerBet == 0) revert ZeroAmount();

        mtx = IERC20(_mtx);
        liquidity = ILiquidityRouter(_liquidity);
        reserve = ICasinoReserve(_reserve);
        rng = IRNGEngine(_rng);
        minBet = _minBet;
        maxBet = _maxBet;
        maxPayoutPerBet = _maxPayoutPerBet;
        dev = _dev;
        governance = _governance;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    modifier notPaused() {
        if (paused) revert CasinoPaused();
        _;
    }

    function placeBet(uint256 amount, bytes calldata gameData) external notPaused {
        if (amount < minBet) revert BetBelowMinimum();
        if (amount > maxBet) revert BetAboveMaximum();

        uint256 blockBets = _betsInBlock[msg.sender][block.number];
        if (blockBets >= maxBetsPerBlock) revert TooManyBetsInBlock();
        _betsInBlock[msg.sender][block.number] = blockBets + 1;

        uint256 potentialPayout = _calculatePotentialPayout(amount);
        if (potentialPayout > maxPayoutPerBet) revert ExceedsMaxPayout();
        uint256 reserveBal = reserve.reserveHealth();
        if (potentialPayout > reserveBal) revert MaxPayoutExceedsReserve();

        if (!mtx.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit BetPlaced(msg.sender, amount, gameData);

        uint256 liquidityAmount = (amount * liquidityPercent) / 100;
        uint256 reserveAmount = (amount * reservePercent) / 100;
        uint256 devAmount = (amount * devPercent) / 100;

        if (liquidityAmount > 0) {
            liquidity.addLiquidity(liquidityAmount);
        }

        if (reserveAmount > 0) {
            reserve.deposit(reserveAmount);
        }

        if (devAmount > 0) {
            if (!mtx.transfer(dev, devAmount)) revert DevPaymentFailed();
        }

        bool win = rng.resolve(gameData);
        uint256 payout = 0;

        if (win) {
            payout = potentialPayout;
            reserve.payWinner(msg.sender, payout);
        }

        totalBets++;
        totalWagered += amount;
        totalPayout += payout;
        if (amount >= payout) {
            houseProfit += (amount - payout);
        } else {
            houseProfit -= (payout - amount);
        }

        emit BetResolved(msg.sender, amount, win, payout);
    }

    function _calculatePotentialPayout(uint256 amount) internal view returns (uint256) {
        uint256 payoutPool = (amount * payoutPercent) / 100;
        uint256 payout = (payoutPool * payoutMultiplierBps) / BPS_DENOMINATOR;
        if (payout > maxPayoutPerBet) {
            payout = maxPayoutPerBet;
        }
        return payout;
    }

    function previewPayout(uint256 amount) external view returns (uint256) {
        return _calculatePotentialPayout(amount);
    }

    function reserveBalance() external view returns (uint256) {
        return reserve.reserveHealth();
    }

    function houseEdgeBps() external view returns (uint256) {
        uint256 expectedReturnBps = (payoutPercent * payoutMultiplierBps) / 100;
        if (expectedReturnBps >= 10000) return 0;
        return 10000 - expectedReturnBps;
    }

    function updatePercentages(
        uint256 payout,
        uint256 liquidity_,
        uint256 reserve_,
        uint256 dev_
    ) external onlyGovernance {
        if (payout + liquidity_ + reserve_ + dev_ != 100) revert InvalidPercentageSum();
        payoutPercent = payout;
        liquidityPercent = liquidity_;
        reservePercent = reserve_;
        devPercent = dev_;
        emit PercentagesUpdated(payout, liquidity_, reserve_, dev_);
    }

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyGovernance {
        if (_minBet == 0 || _maxBet == 0 || _minBet > _maxBet) revert InvalidBetLimit();
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    function setPayoutMultiplier(uint256 _multiplierBps) external onlyGovernance {
        if (_multiplierBps == 0) revert InvalidMultiplier();
        emit PayoutMultiplierUpdated(payoutMultiplierBps, _multiplierBps);
        payoutMultiplierBps = _multiplierBps;
    }

    function setMaxPayoutPerBet(uint256 _maxPayout) external onlyGovernance {
        if (_maxPayout == 0) revert ZeroAmount();
        emit MaxPayoutUpdated(maxPayoutPerBet, _maxPayout);
        maxPayoutPerBet = _maxPayout;
    }

    function setMaxBetsPerBlock(uint256 _maxBets) external onlyGovernance {
        emit MaxBetsPerBlockUpdated(maxBetsPerBlock, _maxBets);
        maxBetsPerBlock = _maxBets;
    }

    function setPaused(bool _paused) external onlyGovernance {
        paused = _paused;
        emit PauseChanged(_paused);
    }

    function setReserve(address _reserve) external onlyGovernance {
        if (_reserve == address(0)) revert ZeroAddress();
        reserve = ICasinoReserve(_reserve);
    }

    function setRng(address _rng) external onlyGovernance {
        if (_rng == address(0)) revert ZeroAddress();
        rng = IRNGEngine(_rng);
    }

    function setLiquidity(address _liquidity) external onlyGovernance {
        if (_liquidity == address(0)) revert ZeroAddress();
        liquidity = ILiquidityRouter(_liquidity);
    }

    function setDev(address _dev) external onlyGovernance {
        if (_dev == address(0)) revert ZeroAddress();
        dev = _dev;
    }

    function setGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert ZeroAddress();
        governance = _governance;
    }

    function setMtx(address _mtx) external onlyGovernance {
        if (_mtx == address(0)) revert ZeroAddress();
        mtx = IERC20(_mtx);
    }

    function seedReserve() external onlyGovernance {
        uint256 actualBalance = mtx.balanceOf(address(reserve));
        uint256 currentBalance = reserve.reserveHealth();
        if (actualBalance <= currentBalance) revert ZeroAmount();
        reserve.deposit(actualBalance - currentBalance);
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyGovernance {
        if (to == address(0)) revert ZeroAddress();
        if (!mtx.transfer(to, amount)) revert TransferFailed();
    }
}`;

// OpenZeppelin sources
const OZ_ERC20 = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/ERC20.${"so"}l)

pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.${"so"}l";
import {IERC20Metadata} from "./extensions/IERC20Metadata.${"so"}l";
import {Context} from "../../utils/Context.${"so"}l";
import {IERC20Errors} from "../../interfaces/draft-IERC6093.${"so"}l";

abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                _totalSupply -= value;
            }
        } else {
            unchecked {
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}`;

const OZ_IERC20 = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}`;

const OZ_IERC20_METADATA = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/extensions/IERC20Metadata.${"so"}l)

pragma solidity >=0.6.2;

import {IERC20} from "../IERC20.${"so"}l";

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}`;

const OZ_OWNABLE = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.${"so"}l)

pragma solidity ^0.8.20;

import {Context} from "../utils/Context.${"so"}l";

abstract contract Ownable is Context {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}`;

const OZ_CONTEXT = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}`;

const OZ_IERC6093 = `// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (interfaces/draft-IERC6093.sol)

pragma solidity >=0.8.4;

interface IERC20Errors {
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidSpender(address spender);
}

interface IERC721Errors {
    error ERC721InvalidOwner(address owner);
    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);
    error ERC721InvalidSender(address sender);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InsufficientApproval(address operator, uint256 tokenId);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);
}

interface IERC1155Errors {
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);
    error ERC1155InvalidSender(address sender);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155MissingApprovalForAll(address operator, address owner);
    error ERC1155InvalidApprover(address approver);
    error ERC1155InvalidOperator(address operator);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}`;

// ============================================================
// Contracts to verify
// ============================================================
const CONTRACTS = [
  {
    name: "MatrixHubCoin",
    sourceName: "contracts/MatrixHubCoin.sol",
    address: "0xDCb51dE3359C946364F707556aC8e6C6f2e69A8a",
    source: MATRIX_HUB_COIN_SOURCE,
    constructorArgs: [
      { type: "uint256", value: "1000000000" },
      { type: "address", value: DEPLOYER }
    ],
    needsOpenZeppelin: true
  },
  {
    name: "CasinoReserve",
    sourceName: "contracts/CasinoReserve.sol",
    address: "0x70561ac30aedee7a09cb3840a1c7e441fd80195f",
    source: CASINO_RESERVE_SOURCE,
    constructorArgs: [
      { type: "address", value: MTX },
      { type: "uint256", value: "1000000000000000000000000000" },
      { type: "address", value: "0x0000000000000000000000000000000000000000" }
    ],
    needsOpenZeppelin: true
  },
  {
    name: "RNGEngine",
    sourceName: "contracts/RNGEngine.sol",
    address: "0x53307e1db6c5cb6773c9495ca140372016dfe266",
    source: RNG_ENGINE_SOURCE,
    constructorArgs: [
      { type: "address", value: "0x0000000000000000000000000000000000000000" }
    ],
    needsOpenZeppelin: false
  },
  {
    name: "LiquidityRouter",
    sourceName: "contracts/LiquidityRouter.sol",
    address: "0x1d0787d70fc0d3111408c030e5c9de247dc0104b",
    source: LIQUIDITY_ROUTER_SOURCE,
    constructorArgs: [
      { type: "address", value: MTX },
      { type: "address", value: DEPLOYER }
    ],
    needsOpenZeppelin: true
  },
  {
    name: "CasinoCore",
    sourceName: "contracts/CasinoCore.sol",
    address: "0x2fbee7a063dafc8adadfaa1c351796407454a1e0",
    source: CASINO_CORE_SOURCE,
    constructorArgs: [
      { type: "address", value: MTX },
      { type: "address", value: "0x1d0787d70fc0d3111408c030e5c9de247dc0104b" },
      { type: "address", value: "0x70561ac30aedee7a09cb3840a1c7e441fd80195f" },
      { type: "address", value: "0x53307e1db6c5cb6773c9495ca140372016dfe266" },
      { type: "uint256", value: "1000000000000000" },
      { type: "uint256", value: "1000000000000000000000" },
      { type: "uint256", value: "10000000000000000000000" },
      { type: "address", value: DEPLOYER },
      { type: "address", value: DEPLOYER }
    ],
    needsOpenZeppelin: true
  }
];

// ============================================================
// ABI-encode constructor arguments
// ============================================================
function encodeConstructorArgs(args) {
  let encoded = "0x";
  for (const arg of args) {
    if (arg.type === "uint256" || arg.type === "uint8") {
      let hexVal = BigInt(arg.value).toString(16);
      encoded += hexVal.padStart(64, "0");
    } else if (arg.type === "address") {
      let hexAddr = arg.value.toLowerCase().replace(/^0x/, "");
      encoded += hexAddr.padStart(64, "0");
    } else {
      throw new Error("Unsupported type: " + arg.type);
    }
  }
  return encoded;
}

// ============================================================
// Build sources for standard JSON input
// ============================================================
function buildSources(contract) {
  const sources = {};
  sources[contract.sourceName] = { content: contract.source };

  if (contract.needsOpenZeppelin) {
    sources["@openzeppelin/contracts/token/ERC20/ERC20.sol"] = { content: OZ_ERC20 };
    sources["@openzeppelin/contracts/token/ERC20/IERC20.sol"] = { content: OZ_IERC20 };
    sources["@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol"] = { content: OZ_IERC20_METADATA };
    sources["@openzeppelin/contracts/access/Ownable.sol"] = { content: OZ_OWNABLE };
    sources["@openzeppelin/contracts/utils/Context.sol"] = { content: OZ_CONTEXT };
    sources["@openzeppelin/contracts/interfaces/draft-IERC6093.sol"] = { content: OZ_IERC6093 };
  }

  return sources;
}

// ============================================================
// HTTP helpers — uses fetch() (available in Remix browser & Node 18+)
// Falls back to a CORS proxy if direct fetch is blocked
// ============================================================
const CORS_PROXY = "https://corsproxy.io/?url=";

async function httpsPost(url, postData) {
  // Try direct fetch first, then CORS proxy
  const tryFetch = async (targetUrl) => {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postData
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { status: "0", message: "Parse error", result: text.substring(0, 500) };
    }
  };

  try {
    return await tryFetch(url);
  } catch (e) {
    console.log("  Direct POST failed (" + e.message + "), trying CORS proxy...");
    return await tryFetch(CORS_PROXY + encodeURIComponent(url));
  }
}

async function httpsGet(url) {
  const tryFetch = async (targetUrl) => {
    const response = await fetch(targetUrl);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { status: "0", message: "Parse error", result: text.substring(0, 500) };
    }
  };

  try {
    return await tryFetch(url);
  } catch (e) {
    console.log("  Direct GET failed (" + e.message + "), trying CORS proxy...");
    return await tryFetch(CORS_PROXY + encodeURIComponent(url));
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Submit verification
// ============================================================
async function verifyContract(contract) {
  console.log(`\n=== Verifying ${contract.name} at ${contract.address} ===`);

  const constructorArgsEncoded = encodeConstructorArgs(contract.constructorArgs);
  console.log("Constructor args encoded:", constructorArgsEncoded);

  const sources = buildSources(contract);
  console.log("  Sources loaded:", Object.keys(sources).join(", "));

  const standardInput = {
    language: "Solidity",
    sources: sources,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      // NOTE: do NOT send evmVersion:"default" — solc rejects it with
      // "Invalid EVM version requested." Omitting the key makes solc 0.8.20
      // use its default (shanghai), matching the deployed bytecode.
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode"]
        }
      }
    }
  };

  const sourceCodeJson = JSON.stringify(standardInput);

  const params = new URLSearchParams();
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  params.append("apikey", POLYGONSCAN_API_KEY);
  params.append("codeformat", "solidity-standard-json-input");
  params.append("sourceCode", sourceCodeJson);
  params.append("contractname", contract.sourceName + ":" + contract.name);
  params.append("compilerversion", "v0.8.20+commit.a1b79de6");
  params.append("constructorArguements", constructorArgsEncoded);
  params.append("licenseType", "3");

  console.log("Submitting to Polygonscan API (direct HTTPS, no CORS)...");
  const result = await httpsPost(API_URL, params.toString());
  console.log("API Response:", JSON.stringify(result));

  if (result.status === "1" && result.message === "OK") {
    const guid = result.result;
    console.log("Verification GUID:", guid);
    console.log("Polling for verification status...");

    for (let i = 0; i < 15; i++) {
      await sleep(5000);

      const statusParams = new URLSearchParams();
      statusParams.append("module", "contract");
      statusParams.append("action", "checkverifystatus");
      statusParams.append("apikey", POLYGONSCAN_API_KEY);
      statusParams.append("guid", guid);

      const statusUrl = API_URL + "?" + statusParams.toString();
      const statusResult = await httpsGet(statusUrl);
      console.log(`  Poll ${i + 1}: ${statusResult.message || JSON.stringify(statusResult)}`);

      if (statusResult.status === "1") {
        console.log(`✅ ${contract.name} verified successfully!`);
        console.log(`   https://polygonscan.com/address/${contract.address}#code`);
        return true;
      } else if (statusResult.message === "Already Verified") {
        console.log(`✅ ${contract.name} was already verified!`);
        return true;
      } else if (statusResult.message === "Contract name not found" || statusResult.message === "Fail - Unable to verify") {
        console.log(`❌ ${contract.name} verification failed: ${statusResult.message}`);
        if (statusResult.result) console.log("   Details:", statusResult.result);
        return false;
      }
    }
    console.log(`⏰ ${contract.name} verification timed out (still pending)`);
    return false;
  } else {
    console.log(`❌ ${contract.name} submission failed: ${result.message || "unknown"}`);
    if (result.result) console.log("   Details:", result.result);
    return false;
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("Starting Polygonscan verification for all casino contracts...");
  console.log("API Key:", POLYGONSCAN_API_KEY.substring(0, 8) + "...");

  const results = { succeeded: [], failed: [] };

  for (const contract of CONTRACTS) {
    try {
      const success = await verifyContract(contract);
      if (success) {
        results.succeeded.push(contract.name);
      } else {
        results.failed.push(contract.name);
      }
    } catch (e) {
      console.log(`❌ ${contract.name} error: ${e.message}`);
      results.failed.push(contract.name);
    }
    // Wait between submissions to avoid rate limiting
    if (CONTRACTS.indexOf(contract) < CONTRACTS.length - 1) {
      console.log("  Waiting 3s before next contract...");
      await sleep(3000);
    }
  }

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(`\n✅ Succeeded (${results.succeeded.length}):`);
  results.succeeded.forEach(name => console.log(`   - ${name}`));
  console.log(`\n❌ Failed (${results.failed.length}):`);
  results.failed.forEach(name => console.log(`   - ${name}`));
  console.log(`\n${results.succeeded.length}/${CONTRACTS.length} contracts verified.`);
}

main().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
