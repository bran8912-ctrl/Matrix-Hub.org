// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CasinoCore - Matrix Hub Casino Core Contract
 * @dev Casino management contract for Polygon
 * @notice Uses MTX (ERC-20) token for all casino operations
 *
 * Network: Polygon (Chain ID: 137)
 * Currency: MATIC
 * Token: MTX (Matrix Hub Coin)
 */

// Use OpenZeppelin IERC20 interface for MatrixHubCoin (MTX)
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ILiquidityRouter
 * @author Matrix-Hub Team
 * @notice Interface for liquidity management
 */
interface ILiquidityRouter {
    /**
     * @notice Add liquidity to the pool
     * @param amount Amount of MTX to add to liquidity
     */
    function addLiquidity(uint256 amount) external;
}

/**
 * @title ICasinoReserve
 * @author Matrix-Hub Team
 * @notice Interface for casino reserve management
 */
interface ICasinoReserve {
    /**
     * @notice Deposit MTX into the reserve
     * @param amount Amount of MTX to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Pay a winner from the reserve
     * @param to Address of the winner
     * @param amount Amount of MTX to pay
     */
    function payWinner(address to, uint256 amount) external;

    /**
     * @notice Check reserve balance
     * @return Current reserve balance
     */
    function reserveHealth() external view returns (uint256);
}

/**
 * @title IRNGEngine
 * @author Matrix-Hub Team
 * @notice Interface for random number generation
 */
interface IRNGEngine {
    /**
     * @notice Resolve game outcome based on game data
     * @param gameData Encoded game data
     * @return True if player wins, false otherwise
     */
    function resolve(bytes calldata gameData) external returns (bool);
}

/**
 * @title CasinoCore
 * @author Matrix-Hub Team
 * @notice Main casino contract managing bets, payouts, and game logic on Polygon
 * @dev Uses MTX token for all operations and integrates with external modules
 *
 * House strategy overview:
 *   - House edge is embedded in the payout multiplier (e.g. 1.9x on 50/50 games → 5% edge)
 *   - Percentages split the BET amount between liquidity, reserve, and dev
 *   - The payout pool (payoutPercent) is the portion of the bet allocated to potential winnings
 *   - Payout multiplier controls how much winners receive relative to their payout pool share
 *   - Max single payout capped to reserve balance to guarantee solvency
 *   - Emergency pause, max bets per block, and loss streak tracking protect the house
 */
contract CasinoCore {
    // ═══════════════════════════════════════════════════════════════════════════
    // Custom errors (gas-efficient)
    // ═══════════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a bet is placed
    /// @param player Address of the player
    /// @param amount Bet amount in MTX
    /// @param gameData Encoded game data
    event BetPlaced(address indexed player, uint256 indexed amount, bytes gameData);

    /// @notice Emitted when a bet is resolved
    /// @param player Address of the player
    /// @param amount Original bet amount in MTX
    /// @param win True if player won, false otherwise
    /// @param payout Payout amount (0 if loss)
    event BetResolved(address indexed player, uint256 indexed amount, bool win, uint256 payout);

    /// @notice Emitted when percentages are updated
    event PercentagesUpdated(uint256 payout, uint256 liquidity, uint256 reserve, uint256 dev);

    /// @notice Emitted when bet limits are updated
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);

    /// @notice Emitted when the payout multiplier is updated
    event PayoutMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    /// @notice Emitted when max payout per bet is updated
    event MaxPayoutUpdated(uint256 oldMaxPayout, uint256 newMaxPayout);

    /// @notice Emitted when the casino is paused or unpaused
    event PauseChanged(bool paused);

    /// @notice Emitted when max bets per block is updated
    event MaxBetsPerBlockUpdated(uint256 oldLimit, uint256 newLimit);

    // ═══════════════════════════════════════════════════════════════════════════
    // State variables
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice MTX token contract
    IERC20 public mtx;

    /// @notice Liquidity router contract
    ILiquidityRouter public liquidity;

    /// @notice Casino reserve contract
    ICasinoReserve public reserve;

    /// @notice Random number generator contract
    IRNGEngine public rng;

    // ── Fee split (applied to every bet amount, must sum to 100) ──────────────
    /// @notice Percentage of bet allocated to the payout pool (default 88)
    uint256 public payoutPercent = 88;

    /// @notice Percentage of bet allocated to liquidity (default 6)
    uint256 public liquidityPercent = 6;

    /// @notice Percentage of bet allocated to reserve (default 4)
    uint256 public reservePercent = 4;

    /// @notice Percentage of bet allocated to dev (default 2)
    uint256 public devPercent = 2;

    // ── Payout configuration ──────────────────────────────────────────────────
    /// @notice Payout multiplier in basis points (e.g. 19000 = 1.9x)
    /// @dev Applied to (bet * payoutPercent / 100) on win. Higher = more player-friendly.
    ///      19000 with ~50% win rate → 5% house edge. 20000 with ~50% → 0% edge (break-even).
    uint256 public payoutMultiplierBps = 19000;

    /// @notice Maximum payout per single bet (hard cap, protects reserve solvency)
    uint256 public maxPayoutPerBet;

    // ── Bet limits ────────────────────────────────────────────────────────────
    /// @notice Minimum bet amount (18 decimals)
    uint256 public minBet;

    /// @notice Maximum bet amount (18 decimals)
    uint256 public maxBet;

    // ── Access control ────────────────────────────────────────────────────────
    /// @notice Developer address (collects dev fee)
    address public dev;

    /// @notice Governance address (can update all parameters)
    address public governance;

    // ── Risk controls ────────────────────────────────────────────────────────
    /// @notice Emergency pause flag — when true, all bets are blocked
    bool public paused;

    /// @notice Max bets a single address can place in one block (anti-bot)
    uint256 public maxBetsPerBlock = 3;

    /// @notice Tracks bets placed per address per block
    mapping(address => mapping(uint256 => uint256)) private _betsInBlock;

    /// @notice Total bets placed (lifetime)
    uint256 public totalBets;

    /// @notice Total MTX wagered (lifetime)
    uint256 public totalWagered;

    /// @notice Total MTX paid out (lifetime)
    uint256 public totalPayout;

    /// @notice Total house profit (lifetime) = totalWagered - totalPayout - fees distributed
    uint256 public houseProfit;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Basis points denominator
    uint256 private constant BPS_DENOMINATOR = 10000;

    // ═══════════════════════════════════════════════════════ ​​══​​​════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Constructor initializes casino with required contract addresses
     * @dev Sets up all contract integrations and parameters
     * @param _mtx Address of deployed MatrixHubCoin (MTX) ERC-20 contract on Polygon
     * @param _liquidity Address of LiquidityRouter contract
     * @param _reserve Address of CasinoReserve contract
     * @param _rng Address of RNGEngine contract
     * @param _minBet Minimum bet amount in MTX (with 18 decimals)
     * @param _maxBet Maximum bet amount in MTX (with 18 decimals)
     * @param _maxPayoutPerBet Hard cap on payout for a single bet (18 decimals)
     * @param _dev Developer address for fee collection
     * @param _governance Governance address for parameter updates
     */
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Modifier to restrict access to governance only
     */
    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    /**
     * @notice Modifier to block all bets when paused
     */
    modifier notPaused() {
        if (paused) revert CasinoPaused();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Core betting logic
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Place a bet in the casino
     * @dev User must approve CasinoCore for MTX spend before calling
     * @param amount Bet amount in MTX (18 decimals)
     * @param gameData Encoded game data for RNG
     *
     * Flow:
     *   1. Validate bet amount and casino state
     *   2. Transfer bet from player to CasinoCore
     *   3. Split bet: liquidity portion, reserve portion, dev fee
     *   4. Resolve win/loss via RNG
     *   5. If win → calculate payout (bet * payoutPercent / 100 * multiplierBps / 10000)
     *      capped at maxPayoutPerBet and reserve balance → pay from reserve
     *   6. Track stats
     */
    function placeBet(uint256 amount, bytes calldata gameData) external notPaused {
        if (amount < minBet) revert BetBelowMinimum();
        if (amount > maxBet) revert BetAboveMaximum();

        // Anti-bot: limit bets per address per block
        uint256 blockBets = _betsInBlock[msg.sender][block.number];
        if (blockBets >= maxBetsPerBlock) revert TooManyBetsInBlock();
        _betsInBlock[msg.sender][block.number] = blockBets + 1;

        // Check reserve can cover the worst-case payout BEFORE accepting the bet
        uint256 potentialPayout = _calculatePotentialPayout(amount);
        if (potentialPayout > maxPayoutPerBet) revert ExceedsMaxPayout();
        uint256 reserveBal = reserve.reserveHealth();
        if (potentialPayout > reserveBal) revert MaxPayoutExceedsReserve();

        // Transfer bet from player
        if (!mtx.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit BetPlaced(msg.sender, amount, gameData);

        // ── Split the bet ───────────────────────────────────────────────────
        uint256 liquidityAmount = (amount * liquidityPercent) / 100;
        uint256 reserveAmount = (amount * reservePercent) / 100;
        uint256 devAmount = (amount * devPercent) / 100;

        // Route liquidity
        if (liquidityAmount > 0) {
            liquidity.addLiquidity(liquidityAmount);
        }

        // Deposit to reserve (grows the payout pool)
        if (reserveAmount > 0) {
            reserve.deposit(reserveAmount);
        }

        // Dev payment
        if (devAmount > 0) {
            if (!mtx.transfer(dev, devAmount)) revert DevPaymentFailed();
        }

        // ── Resolve outcome ─────────────────────────────────────────────────
        bool win = rng.resolve(gameData);
        uint256 payout = 0;

        if (win) {
            payout = potentialPayout;
            reserve.payWinner(msg.sender, payout);
        }

        // ── Track stats ─────────────────────────────────────────────────────
        totalBets++;
        totalWagered += amount;
        totalPayout += payout;
        // houseProfit = amount kept by house - payout to player
        // (liquidity, reserve, dev are already routed; payout comes from reserve)
        if (amount >= payout) {
            houseProfit += (amount - payout);
        } else {
            houseProfit -= (payout - amount); // rare: payout > bet (multiplier effect from reserve)
        }

        emit BetResolved(msg.sender, amount, win, payout);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal payout calculation
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate the potential payout for a given bet amount
     * @dev payout = bet * payoutPercent / 100 * payoutMultiplierBps / 10000
     *      Capped at maxPayoutPerBet
     * @param amount Bet amount in MTX
     * @return Payout amount in MTX
     */
    function _calculatePotentialPayout(uint256 amount) internal view returns (uint256) {
        uint256 payoutPool = (amount * payoutPercent) / 100;
        uint256 payout = (payoutPool * payoutMultiplierBps) / BPS_DENOMINATOR;
        if (payout > maxPayoutPerBet) {
            payout = maxPayoutPerBet;
        }
        return payout;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Preview the payout for a given bet amount (if win)
     * @param amount Bet amount in MTX
     * @return Potential payout in MTX
     */
    function previewPayout(uint256 amount) external view returns (uint256) {
        return _calculatePotentialPayout(amount);
    }

    /**
     * @notice Current reserve balance available for payouts
     * @return Reserve balance in MTX
     */
    function reserveBalance() external view returns (uint256) {
        return reserve.reserveHealth();
    }

    /**
     * @notice Effective house edge in basis points
     * @dev edge = (10000 - payoutPercent * payoutMultiplierBps / 10000)
     *      Assumes ~50% win rate. Actual edge depends on game/RNG.
     * @return House edge in basis points
     */
    function houseEdgeBps() external view returns (uint256) {
        // Expected return per 1 MTX bet = (winRate * payout)
        // With 50% win rate: expectedReturn = 0.5 * (payoutPercent/100 * multiplierBps/10000)
        // House edge = 1 - expectedReturn (in BPS)
        // Simplified: edge = 10000 - (payoutPercent * payoutMultiplierBps / 100)
        uint256 expectedReturnBps = (payoutPercent * payoutMultiplierBps) / 100;
        if (expectedReturnBps >= 10000) return 0;
        return 10000 - expectedReturnBps;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Governance: parameter updates
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update percentage allocations for fee split
     * @dev Only callable by governance, percentages must sum to 100
     * @param payout Percentage allocated to payout pool
     * @param liquidity_ Percentage allocated to liquidity
     * @param reserve_ Percentage allocated to reserve
     * @param dev_ Percentage allocated to dev
     */
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

    /**
     * @notice Update bet limits
     * @dev Only callable by governance
     * @param _minBet New minimum bet (18 decimals)
     * @param _maxBet New maximum bet (18 decimals)
     */
    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyGovernance {
        if (_minBet == 0 || _maxBet == 0 || _minBet > _maxBet) revert InvalidBetLimit();
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    /**
     * @notice Update the payout multiplier (controls house edge)
     * @dev Only callable by governance
     * @param _multiplierBps New multiplier in basis points (e.g. 19000 = 1.9x)
     *       Must be > 0. Lower = more house edge. 20000 = break-even at 50% win rate.
     */
    function setPayoutMultiplier(uint256 _multiplierBps) external onlyGovernance {
        if (_multiplierBps == 0) revert InvalidMultiplier();
        emit PayoutMultiplierUpdated(payoutMultiplierBps, _multiplierBps);
        payoutMultiplierBps = _multiplierBps;
    }

    /**
     * @notice Update the maximum payout per single bet
     * @dev Only callable by governance. Protects reserve from large drains.
     * @param _maxPayout New max payout per bet (18 decimals)
     */
    function setMaxPayoutPerBet(uint256 _maxPayout) external onlyGovernance {
        if (_maxPayout == 0) revert ZeroAmount();
        emit MaxPayoutUpdated(maxPayoutPerBet, _maxPayout);
        maxPayoutPerBet = _maxPayout;
    }

    /**
     * @notice Update max bets per block per address (anti-bot)
     * @dev Only callable by governance
     * @param _maxBets New limit (0 = unlimited)
     */
    function setMaxBetsPerBlock(uint256 _maxBets) external onlyGovernance {
        emit MaxBetsPerBlockUpdated(maxBetsPerBlock, _maxBets);
        maxBetsPerBlock = _maxBets;
    }

    /**
     * @notice Emergency pause — blocks all new bets
     * @dev Only callable by governance. Does not affect withdrawals or reads.
     */
    function setPaused(bool _paused) external onlyGovernance {
        paused = _paused;
        emit PauseChanged(_paused);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Governance: address updates
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update casino reserve address (governance only)
    /// @param _reserve New CasinoReserve contract address
    function setReserve(address _reserve) external onlyGovernance {
        if (_reserve == address(0)) revert ZeroAddress();
        reserve = ICasinoReserve(_reserve);
    }

    /// @notice Update RNG engine address (governance only)
    /// @param _rng New RNGEngine contract address
    function setRng(address _rng) external onlyGovernance {
        if (_rng == address(0)) revert ZeroAddress();
        rng = IRNGEngine(_rng);
    }

    /// @notice Update liquidity router address (governance only)
    /// @param _liquidity New LiquidityRouter contract address
    function setLiquidity(address _liquidity) external onlyGovernance {
        if (_liquidity == address(0)) revert ZeroAddress();
        liquidity = ILiquidityRouter(_liquidity);
    }

    /// @notice Update dev address (governance only)
    /// @param _dev New developer address
    function setDev(address _dev) external onlyGovernance {
        if (_dev == address(0)) revert ZeroAddress();
        dev = _dev;
    }

    /// @notice Update governance address (governance only)
    /// @param _governance New governance address
    function setGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert ZeroAddress();
        governance = _governance;
    }

    /// @notice Update MTX token address (governance only)
    /// @param _mtx New MTX token contract address
    function setMtx(address _mtx) external onlyGovernance {
        if (_mtx == address(0)) revert ZeroAddress();
        mtx = IERC20(_mtx);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Emergency functions
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Seed the reserve balance to match actual MTX held by CasinoReserve
     * @dev Only callable by governance. Call once after funding CasinoReserve
     *      with an initial token transfer so that placeBet() doesn't revert.
     *      This syncs reserveBalance with the actual MTX tokens already sent.
     */
    function seedReserve() external onlyGovernance {
        uint256 actualBalance = mtx.balanceOf(address(reserve));
        uint256 currentBalance = reserve.reserveHealth();
        if (actualBalance <= currentBalance) revert ZeroAmount();
        reserve.deposit(actualBalance - currentBalance);
    }

    /**
     * @notice Emergency withdrawal of stuck MTX tokens
     * @dev Only callable by governance. Use for recovery, not regular operation.
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyGovernance {
        if (to == address(0)) revert ZeroAddress();
        if (!mtx.transfer(to, amount)) revert TransferFailed();
    }
}
