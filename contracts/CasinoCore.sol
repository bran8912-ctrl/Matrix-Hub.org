// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ILiquidityRouter {
    function depositLiquidity(uint256 amount) external;
}

interface ICasinoReserve {
    function deposit(uint256 amount) external;
    function payWinner(address to, uint256 amount) external;
    function refundBet(address player, uint256 amount) external;
    function reserveHealth() external view returns (uint256);
}

interface IRNGEngine {
    function requestRandomWords() external returns (uint256 requestId);
}

contract CasinoCore is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotGovernance();
    error NotRng();
    error BetBelowMinimum();
    error BetAboveMaximum();
    error BetNotFound();
    error BetNotClaimable();
    error NotBetPlayer();
    error TransferFailed();
    error InvalidPercentageSum();
    error ZeroAddress();
    error CasinoPaused();
    error ExceedsMaxPayout();
    error MaxPayoutExceedsReserve();
    error TooManyBetsInBlock();
    error InvalidBetLimit();
    error InvalidTarget();
    error ZeroAmount();
    error AmountTooLarge();
    error ActiveBetsPreventModuleChange();
    error DuplicateRandomnessRequest();
    error BetNotRefundable();
    error RefundTooEarly();
    error EmergencyWithdrawExceedsCap();

    enum BetStatus {
        None,
        Pending,
        Settled,
        Claimed,
        Refunded
    }

    struct Bet {
        address player;
        uint256 amount;
        uint256 payout;
        uint256 reservedPayout;
        uint8 target;
        uint8 roll;
        BetStatus status;
        bool win;
        uint256 placedAt;
        uint256 requestId;
        // Slots (gameId == GAME_SLOTS): the three reel stop positions
        // (0-19 each) derived from the VRF word at settlement. All zero
        // for Dice bets and for Slots bets still Pending.
        uint8 gameId;
        uint8 reel0;
        uint8 reel1;
        uint8 reel2;
    }

    uint8 public constant GAME_DICE = 0;
    uint8 public constant GAME_SLOTS = 1;

    // Slots v1 (design: bot-core/go-live/next-casino-game-design.md,
    // Nina Petrov 2026-11-10). 3 reels, 20 stops each, identical strip:
    // symbol ids 0=SEVEN (1 stop), 1=BAR (2), 2=BELL (3), 3=PLUM (4),
    // 4=LEMON (4), 5=CHERRY (6). Paytable multipliers of the bet:
    // 3x SEVEN 100, 3x BAR 100, 3x BELL 40, 3x PLUM 25, 3x LEMON 15,
    // 3x CHERRY 12, plus two CHERRY on reels 1-2 only pays 1x (stake
    // back). RTP = 7,636 / 8,000 = 95.45% (see slotsRtpBps()).
    uint256 public constant SLOTS_MAX_MULTIPLIER = 100;
    uint8 public constant SLOTS_SYMBOL_SEVEN = 0;
    uint8 public constant SLOTS_SYMBOL_BAR = 1;
    uint8 public constant SLOTS_SYMBOL_BELL = 2;
    uint8 public constant SLOTS_SYMBOL_PLUM = 3;
    uint8 public constant SLOTS_SYMBOL_LEMON = 4;
    uint8 public constant SLOTS_SYMBOL_CHERRY = 5;

    event BetPlaced(
        uint256 indexed betId,
        address indexed player,
        uint256 amount,
        uint8 target
    );
    event BetRequested(
        uint256 indexed betId,
        uint256 indexed requestId,
        address indexed player,
        uint256 reservedPayout
    );
    event BetResolved(uint256 indexed betId, uint8 roll, bool win, uint256 payout);
    event SlotsBetPlaced(uint256 indexed betId, address indexed player, uint256 amount);
    event SlotsBetResolved(
        uint256 indexed betId,
        uint8 reel0,
        uint8 reel1,
        uint8 reel2,
        uint8 symbol0,
        uint8 symbol1,
        uint8 symbol2,
        bool win,
        uint256 payout
    );
    event PayoutClaimed(uint256 indexed betId, address indexed player, uint256 payout);
    event PercentagesUpdated(uint256 payout, uint256 liquidity, uint256 reserve, uint256 dev);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event MaxPayoutUpdated(uint256 oldMaxPayout, uint256 newMaxPayout);
    event PauseChanged(bool paused);
    event MaxBetsPerBlockUpdated(uint256 oldLimit, uint256 newLimit);
    event BetRefunded(uint256 indexed betId, address indexed player, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    event MaxEmergencyWithdrawUpdated(uint256 oldMax, uint256 newMax);
    event GovernanceUpdated(address indexed previousGovernance, address indexed newGovernance);
    event DevUpdated(address indexed previousDev, address indexed newDev);

    // Fee routing (G-01): these four numbers describe how each bet's MTX is
    // ROUTED on receipt — they are NOT a player-payout split. `payoutPercent`
    // is a reserve-routing share (kept under this name to avoid breaking the
    // public getter ABI): payoutPercent (88) + reservePercent (4) = 92% of
    // every bet is transferred to CasinoReserve. Player payouts are set only
    // by dice maths (_calculateDicePayout, 98% RTP), never by these numbers.
    // No MTX is ever burned by the casino flow.
    uint256 public payoutPercent = 88;
    uint256 public liquidityPercent = 6;
    uint256 public reservePercent = 4;
    uint256 public devPercent = 2;
    uint256 public maxEmergencyWithdraw;

    IERC20 public mtx;
    ILiquidityRouter public liquidity;
    ICasinoReserve public reserve;
    IRNGEngine public rng;

    uint256 public maxPayoutPerBet;
    uint256 public minBet;
    uint256 public maxBet;
    address public dev;
    address public governance;

    bool public paused;
    uint256 public maxBetsPerBlock = 3;
    uint256 public totalBets;
    uint256 public totalWagered;
    uint256 public totalPayout;
    uint256 public lockedPayouts;
    uint256 public activeRandomnessRequests;
    int256 public houseProfit;
    uint256 public nextBetId;

    uint8 public constant MIN_TARGET = 2;
    uint8 public constant MAX_TARGET = 98;
    uint256 public constant HOUSE_RETURN_BPS = 9800;
    uint256 private constant BPS_DENOMINATOR = 10000;

    /// @notice G-04: a bet still Pending after this long may be refunded in
    /// full by governance (refundStuckBet). 1 hour: Chainlink VRF on Polygon
    /// normally fulfils within minutes (3 confirmations + callback), so 1h
    /// is ~12x the normal latency — long enough to rule out a slow callback,
    /// short enough that a player's stake is never stranded for a day. A bet
    /// stuck past this point means the VRF path is dead (subscription out of
    /// LINK, wrong keyHash/consumer, coordinator outage), not slow.
    uint256 public constant STUCK_BET_REFUND_TIMEOUT = 1 hours;

    /// @notice G-03: default per-call cap for emergencyWithdraw, 100 MTX
    /// (18 decimals). CasinoCore normally holds only rounding dust (sub-1-MTX
    /// remainders per bet), so 100 MTX is ~100x any legitimate dust recovery
    /// while far below reserve scale (1,000,000 MTX cap). A compromised
    /// governance key can drain at most this much per call from Core itself;
    /// reserve funds are NOT reachable through emergencyWithdraw. Governance
    /// may raise the cap via setMaxEmergencyWithdraw if a genuine larger
    /// recovery is ever needed; every call is evented.
    uint256 public constant DEFAULT_MAX_EMERGENCY_WITHDRAW = 100 ether;

    mapping(address => mapping(uint256 => uint256)) private _betsInBlock;
    mapping(uint256 => uint256) public requestToBetId;
    mapping(uint256 => Bet) private _bets;

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
        maxEmergencyWithdraw = DEFAULT_MAX_EMERGENCY_WITHDRAW;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    modifier notPaused() {
        if (paused) revert CasinoPaused();
        _;
    }

    /// @notice Shared bet-acceptance path for every game (Dice + Slots):
    /// per-block limit, max-payout cap, reserve headroom check, stake
    /// pull, and the G-01 fee routing. Game entry points compute their
    /// own worst-case `potentialPayout` and validate their own inputs
    /// before calling this.
    function _acceptStake(uint256 amount, uint256 potentialPayout) private {
        uint256 blockBets = _betsInBlock[msg.sender][block.number];
        if (blockBets >= maxBetsPerBlock) revert TooManyBetsInBlock();
        _betsInBlock[msg.sender][block.number] = blockBets + 1;

        if (potentialPayout > maxPayoutPerBet) revert ExceedsMaxPayout();
        if (
            amount > uint256(type(int256).max) ||
            potentialPayout > uint256(type(int256).max)
        ) revert AmountTooLarge();

        uint256 reserveBal = reserve.reserveHealth();
        if (lockedPayouts > reserveBal || potentialPayout > reserveBal - lockedPayouts) {
            revert MaxPayoutExceedsReserve();
        }

        mtx.safeTransferFrom(msg.sender, address(this), amount);

        // Fee routing (G-01): payoutPercent is a RESERVE-routing share, not
        // a player payout. 88% + 4% = 92% of every bet lands in CasinoReserve;
        // 6% queues in the LiquidityRouter; 2% goes to dev. The player's
        // payout, if they win, comes from the reserve per game maths
        // (Dice _calculateDicePayout 98% RTP; Slots paytable 95.45% RTP)
        // — never from these percentages.
        uint256 liquidityAmount = Math.mulDiv(amount, liquidityPercent, 100);
        uint256 reserveAmount =
            Math.mulDiv(amount, payoutPercent, 100) +
            Math.mulDiv(amount, reservePercent, 100);
        uint256 devAmount = Math.mulDiv(amount, devPercent, 100);

        if (liquidityAmount > 0) {
            mtx.safeTransfer(address(liquidity), liquidityAmount);
            liquidity.depositLiquidity(liquidityAmount);
        }
        if (reserveAmount > 0) {
            mtx.safeTransfer(address(reserve), reserveAmount);
            reserve.deposit(reserveAmount);
        }
        if (devAmount > 0) mtx.safeTransfer(dev, devAmount);
    }

    /// @notice Lock the worst-case payout and request the VRF word for a
    /// bet whose record is already stored. Shared by Dice and Slots.
    function _requestRandomnessForBet(uint256 betId, uint256 potentialPayout) private {
        lockedPayouts += potentialPayout;
        activeRandomnessRequests++;

        uint256 requestId = rng.requestRandomWords();
        if (requestToBetId[requestId] != 0) revert DuplicateRandomnessRequest();
        requestToBetId[requestId] = betId;
        _bets[betId].requestId = requestId;

        totalBets++;
        totalWagered += _bets[betId].amount;
        emit BetRequested(betId, requestId, _bets[betId].player, potentialPayout);
    }

    function placeDiceBet(uint256 amount, uint8 target)
        external
        notPaused
        nonReentrant
        returns (uint256 betId)
    {
        if (amount < minBet) revert BetBelowMinimum();
        if (amount > maxBet) revert BetAboveMaximum();
        if (target < MIN_TARGET || target > MAX_TARGET) revert InvalidTarget();

        uint256 potentialPayout = _calculateDicePayout(amount, target);
        _acceptStake(amount, potentialPayout);

        betId = ++nextBetId;
        _bets[betId] = Bet({
            player: msg.sender,
            amount: amount,
            payout: 0,
            reservedPayout: potentialPayout,
            target: target,
            roll: 0,
            status: BetStatus.Pending,
            win: false,
            placedAt: block.timestamp,
            requestId: 0,
            gameId: GAME_DICE,
            reel0: 0,
            reel1: 0,
            reel2: 0
        });
        _requestRandomnessForBet(betId, potentialPayout);
        emit BetPlaced(betId, msg.sender, amount, target);
    }

    /// @notice Slots v1: one spin, one VRF word, three reels. The
    /// worst-case payout is `amount * SLOTS_MAX_MULTIPLIER` (100x), so
    /// with the shipped maxPayoutPerBet of 100 MTX only 1 MTX spins are
    /// accepted (ExceedsMaxPayout above that) — exactly the design's
    /// cap note. Settlement happens in fulfillRandomness; winnings are
    /// paid through the shared claimPayout flow.
    function placeSlotsBet(uint256 amount)
        external
        notPaused
        nonReentrant
        returns (uint256 betId)
    {
        if (amount < minBet) revert BetBelowMinimum();
        if (amount > maxBet) revert BetAboveMaximum();

        uint256 potentialPayout = amount * SLOTS_MAX_MULTIPLIER;
        _acceptStake(amount, potentialPayout);

        betId = ++nextBetId;
        _bets[betId] = Bet({
            player: msg.sender,
            amount: amount,
            payout: 0,
            reservedPayout: potentialPayout,
            target: 0,
            roll: 0,
            status: BetStatus.Pending,
            win: false,
            placedAt: block.timestamp,
            requestId: 0,
            gameId: GAME_SLOTS,
            reel0: 0,
            reel1: 0,
            reel2: 0
        });
        _requestRandomnessForBet(betId, potentialPayout);
        emit BetPlaced(betId, msg.sender, amount, 0);
        emit SlotsBetPlaced(betId, msg.sender, amount);
    }

    function fulfillRandomness(uint256 requestId, uint256 randomWord) external {
        if (msg.sender != address(rng)) revert NotRng();

        uint256 betId = requestToBetId[requestId];
        if (betId == 0) return;

        Bet storage bet = _bets[betId];
        if (bet.status != BetStatus.Pending) return;

        delete requestToBetId[requestId];
        activeRandomnessRequests--;

        if (bet.gameId == GAME_SLOTS) {
            (uint8 r0, uint8 r1, uint8 r2) = slotsReelsFromWord(randomWord);
            uint256 multiplier = slotsMultiplierForReels(r0, r1, r2);
            uint256 slotsPayout = bet.amount * multiplier;
            bool slotsWin = slotsPayout > 0;

            lockedPayouts -= bet.reservedPayout - slotsPayout;
            bet.reservedPayout = slotsPayout;
            bet.payout = slotsPayout;
            bet.reel0 = r0;
            bet.reel1 = r1;
            bet.reel2 = r2;
            bet.win = slotsWin;
            bet.status = BetStatus.Settled;
            totalPayout += slotsPayout;
            houseProfit += int256(bet.amount) - int256(slotsPayout);

            emit SlotsBetResolved(
                betId,
                r0,
                r1,
                r2,
                slotsSymbolAt(r0),
                slotsSymbolAt(r1),
                slotsSymbolAt(r2),
                slotsWin,
                slotsPayout
            );
            return;
        }

        uint8 roll = uint8(randomWord % 100) + 1;
        bool win = roll < bet.target;
        uint256 payout = win ? _calculateDicePayout(bet.amount, bet.target) : 0;

        lockedPayouts -= bet.reservedPayout - payout;
        bet.reservedPayout = payout;
        bet.payout = payout;
        bet.roll = roll;
        bet.win = win;
        bet.status = BetStatus.Settled;
        totalPayout += payout;
        houseProfit += int256(bet.amount) - int256(payout);

        emit BetResolved(betId, roll, win, payout);
    }

    // ---- Slots maths (pure: anyone can reproduce a spin off-chain) ----

    /// @notice Symbol id at a reel stop position (0-19) on the shared
    /// 20-stop strip: 0 -> SEVEN; 1-2 -> BAR; 3-5 -> BELL; 6-9 -> PLUM;
    /// 10-13 -> LEMON; 14-19 -> CHERRY.
    function slotsSymbolAt(uint8 position) public pure returns (uint8) {
        if (position == 0) return SLOTS_SYMBOL_SEVEN;
        if (position <= 2) return SLOTS_SYMBOL_BAR;
        if (position <= 5) return SLOTS_SYMBOL_BELL;
        if (position <= 9) return SLOTS_SYMBOL_PLUM;
        if (position <= 13) return SLOTS_SYMBOL_LEMON;
        return SLOTS_SYMBOL_CHERRY;
    }

    /// @notice Derive the three reel positions from one VRF word:
    /// `word % 20`, `(word / 20) % 20`, `(word / 400) % 20` — the exact
    /// derivation in the Slots design doc. One derivation, no variants.
    function slotsReelsFromWord(uint256 word)
        public
        pure
        returns (uint8 reel0, uint8 reel1, uint8 reel2)
    {
        reel0 = uint8(word % 20);
        reel1 = uint8((word / 20) % 20);
        reel2 = uint8((word / 400) % 20);
    }

    /// @notice Paytable multiplier (of the bet) for three reel positions.
    /// Three of a kind pays per symbol; two CHERRY pays 1x ONLY when the
    /// cherries are on reels 1 and 2 (positions reel0/reel1) and reel 3
    /// is not a cherry — three cherries is the 12x line, and a cherry on
    /// reels 1+3 alone pays nothing.
    function slotsMultiplierForReels(uint8 reel0, uint8 reel1, uint8 reel2)
        public
        pure
        returns (uint256)
    {
        uint8 s0 = slotsSymbolAt(reel0);
        uint8 s1 = slotsSymbolAt(reel1);
        uint8 s2 = slotsSymbolAt(reel2);
        if (s0 == s1 && s1 == s2) {
            if (s0 == SLOTS_SYMBOL_SEVEN) return 100;
            if (s0 == SLOTS_SYMBOL_BAR) return 100;
            if (s0 == SLOTS_SYMBOL_BELL) return 40;
            if (s0 == SLOTS_SYMBOL_PLUM) return 25;
            if (s0 == SLOTS_SYMBOL_LEMON) return 15;
            return 12; // CHERRY
        }
        if (s0 == SLOTS_SYMBOL_CHERRY && s1 == SLOTS_SYMBOL_CHERRY) return 1;
        return 0;
    }

    /// @notice Payout a spin of `amount` would settle at for a given VRF
    /// word. Pure mirror of the fulfillRandomness Slots path.
    function slotsPayoutForWord(uint256 amount, uint256 word) public pure returns (uint256) {
        (uint8 r0, uint8 r1, uint8 r2) = slotsReelsFromWord(word);
        return amount * slotsMultiplierForReels(r0, r1, r2);
    }

    /// @notice Slots RTP in basis points, computed by enumerating all
    /// 20^3 = 8,000 reel combinations through the live paytable:
    /// 7,636 / 8,000 = 9545 bps (95.45%). The deploy guard and the test
    /// suite assert this stays inside 90-99%.
    function slotsRtpBps() public pure returns (uint256) {
        uint256 totalMultiplier = 0;
        for (uint8 a = 0; a < 20; a++) {
            for (uint8 b = 0; b < 20; b++) {
                for (uint8 c = 0; c < 20; c++) {
                    totalMultiplier += slotsMultiplierForReels(a, b, c);
                }
            }
        }
        return (totalMultiplier * 10000) / 8000;
    }

    /// @notice Game marker for a bet: GAME_DICE (0) or GAME_SLOTS (1).
    function getBetGame(uint256 betId) external view returns (uint8) {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        return bet.gameId;
    }

    /// @notice Full Slots view of a bet. Reel positions and symbols are
    /// zero while the bet is Pending (the VRF word has not landed yet);
    /// `multiplier` is the settled paytable multiplier (0 while pending
    /// or on a loss).
    function getSlotsBet(uint256 betId)
        external
        view
        returns (
            address player,
            uint256 amount,
            BetStatus status,
            bool win,
            uint256 payout,
            uint8 reel0,
            uint8 reel1,
            uint8 reel2,
            uint8 symbol0,
            uint8 symbol1,
            uint8 symbol2,
            uint256 multiplier
        )
    {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        if (bet.gameId != GAME_SLOTS) revert BetNotFound();
        multiplier = bet.amount == 0 ? 0 : bet.payout / bet.amount;
        // While Pending the reels have not been drawn: report the symbol
        // sentinel 255 instead of symbol-of-position-0 (SEVEN).
        bool drawn = bet.status != BetStatus.Pending;
        return (
            bet.player,
            bet.amount,
            bet.status,
            bet.win,
            bet.payout,
            bet.reel0,
            bet.reel1,
            bet.reel2,
            drawn ? slotsSymbolAt(bet.reel0) : 255,
            drawn ? slotsSymbolAt(bet.reel1) : 255,
            drawn ? slotsSymbolAt(bet.reel2) : 255,
            multiplier
        );
    }

    function claimPayout(uint256 betId) external nonReentrant {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        if (bet.player != msg.sender) revert NotBetPlayer();
        if (bet.status != BetStatus.Settled || !bet.win) revert BetNotClaimable();

        bet.status = BetStatus.Claimed;
        lockedPayouts -= bet.payout;
        reserve.payWinner(msg.sender, bet.payout);
        emit PayoutClaimed(betId, msg.sender, bet.payout);
    }

    /// @notice G-04: refund a bet whose VRF callback never arrived. Only
    /// governance, only after STUCK_BET_REFUND_TIMEOUT (1 hour) past
    /// placement, only while the bet is still Pending. The player is refunded
    /// their FULL stake: the reserve pays it via refundBet. The 8% of the
    /// stake already routed away at bet time (6% liquidity queue + 2% dev)
    /// is NOT deducted from the player — the house (reserve) absorbs it.
    /// Accounting: the bet's reserved payout is released from lockedPayouts,
    /// the randomness request is de-registered, and the request mapping is
    /// cleared, so a late VRF callback for this bet is a harmless no-op in
    /// fulfillRandomness (status is no longer Pending). A settled or already
    /// refunded bet can never be refunded.
    function refundStuckBet(uint256 betId) external onlyGovernance nonReentrant {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        if (bet.status != BetStatus.Pending) revert BetNotRefundable();
        if (block.timestamp < bet.placedAt + STUCK_BET_REFUND_TIMEOUT) revert RefundTooEarly();

        uint256 amount = bet.amount;
        uint256 reservedPayout = bet.reservedPayout;
        address player = bet.player;
        uint256 requestId = bet.requestId;

        bet.status = BetStatus.Refunded;
        bet.reservedPayout = 0;
        if (requestId != 0) delete requestToBetId[requestId];
        activeRandomnessRequests--;
        lockedPayouts -= reservedPayout;

        reserve.refundBet(player, amount);
        emit BetRefunded(betId, player, amount);
    }

    /// @notice Earliest timestamp at which a Pending bet may be refunded.
    /// @param betId Bet to query.
    /// @return Timestamp after which refundStuckBet will succeed for a
    /// still-Pending bet.
    function refundableAt(uint256 betId) external view returns (uint256) {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        return bet.placedAt + STUCK_BET_REFUND_TIMEOUT;
    }

    function getBet(uint256 betId)
        external
        view
        returns (
            address player,
            uint256 amount,
            uint8 target,
            uint8 roll,
            BetStatus status,
            bool win,
            uint256 payout
        )
    {
        Bet storage bet = _bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound();
        return (bet.player, bet.amount, bet.target, bet.roll, bet.status, bet.win, bet.payout);
    }

    function previewPayout(uint256 amount, uint8 target) external pure returns (uint256) {
        if (target < MIN_TARGET || target > MAX_TARGET) revert InvalidTarget();
        return _calculateDicePayout(amount, target);
    }

    function reserveBalance() external view returns (uint256) {
        return reserve.reserveHealth();
    }

    function houseEdgeBps() external pure returns (uint256) {
        return BPS_DENOMINATOR - HOUSE_RETURN_BPS;
    }

    function updatePercentages(
        uint256 payout,
        uint256 liquidity_,
        uint256 reserve_,
        uint256 dev_
    ) external onlyGovernance {
        if (
            payout > 100 ||
            liquidity_ > 100 ||
            reserve_ > 100 ||
            dev_ > 100 ||
            payout + liquidity_ + reserve_ + dev_ != 100
        ) revert InvalidPercentageSum();
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
        if (activeRandomnessRequests != 0 || lockedPayouts != 0) {
            revert ActiveBetsPreventModuleChange();
        }
        reserve = ICasinoReserve(_reserve);
    }

    function setRng(address _rng) external onlyGovernance {
        if (_rng == address(0)) revert ZeroAddress();
        if (activeRandomnessRequests != 0) revert ActiveBetsPreventModuleChange();
        rng = IRNGEngine(_rng);
    }

    function setLiquidity(address _liquidity) external onlyGovernance {
        if (_liquidity == address(0)) revert ZeroAddress();
        liquidity = ILiquidityRouter(_liquidity);
    }

    function setDev(address _dev) external onlyGovernance {
        if (_dev == address(0)) revert ZeroAddress();
        emit DevUpdated(dev, _dev);
        dev = _dev;
    }

    function setGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert ZeroAddress();
        emit GovernanceUpdated(governance, _governance);
        governance = _governance;
    }

    function setMtx(address _mtx) external onlyGovernance {
        if (_mtx == address(0)) revert ZeroAddress();
        if (activeRandomnessRequests != 0 || lockedPayouts != 0) {
            revert ActiveBetsPreventModuleChange();
        }
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
        if (amount > maxEmergencyWithdraw) revert EmergencyWithdrawExceedsCap();
        mtx.safeTransfer(to, amount);
        emit EmergencyWithdrawal(to, amount);
    }

    /// @notice G-03: change the per-call emergencyWithdraw cap. Governance
    /// only. The cap is a speed bump and audit trail, not a substitute for
    /// multisig governance — a compromised governance key can raise it.
    /// Set it to 0 to disable emergency withdrawals entirely.
    function setMaxEmergencyWithdraw(uint256 _max) external onlyGovernance {
        emit MaxEmergencyWithdrawUpdated(maxEmergencyWithdraw, _max);
        maxEmergencyWithdraw = _max;
    }

    function _calculateDicePayout(uint256 amount, uint8 target) private pure returns (uint256) {
        return Math.mulDiv(amount, HOUSE_RETURN_BPS, 100 * (uint256(target) - 1));
    }
}
