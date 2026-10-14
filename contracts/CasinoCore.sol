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

    enum BetStatus {
        None,
        Pending,
        Settled,
        Claimed
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
    }

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
    event PayoutClaimed(uint256 indexed betId, address indexed player, uint256 payout);
    event PercentagesUpdated(uint256 payout, uint256 liquidity, uint256 reserve, uint256 dev);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
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
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    modifier notPaused() {
        if (paused) revert CasinoPaused();
        _;
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

        uint256 blockBets = _betsInBlock[msg.sender][block.number];
        if (blockBets >= maxBetsPerBlock) revert TooManyBetsInBlock();
        _betsInBlock[msg.sender][block.number] = blockBets + 1;

        uint256 potentialPayout = _calculateDicePayout(amount, target);
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

        betId = ++nextBetId;
        _bets[betId] = Bet({
            player: msg.sender,
            amount: amount,
            payout: 0,
            reservedPayout: potentialPayout,
            target: target,
            roll: 0,
            status: BetStatus.Pending,
            win: false
        });
        lockedPayouts += potentialPayout;
        activeRandomnessRequests++;

        uint256 requestId = rng.requestRandomWords();
        if (requestToBetId[requestId] != 0) revert DuplicateRandomnessRequest();
        requestToBetId[requestId] = betId;

        totalBets++;
        totalWagered += amount;
        emit BetPlaced(betId, msg.sender, amount, target);
        emit BetRequested(betId, requestId, msg.sender, potentialPayout);
    }

    function fulfillRandomness(uint256 requestId, uint256 randomWord) external {
        if (msg.sender != address(rng)) revert NotRng();

        uint256 betId = requestToBetId[requestId];
        if (betId == 0) return;

        Bet storage bet = _bets[betId];
        if (bet.status != BetStatus.Pending) return;

        delete requestToBetId[requestId];
        activeRandomnessRequests--;

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
        dev = _dev;
    }

    function setGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert ZeroAddress();
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
        mtx.safeTransfer(to, amount);
    }

    function _calculateDicePayout(uint256 amount, uint8 target) private pure returns (uint256) {
        return Math.mulDiv(amount, HOUSE_RETURN_BPS, 100 * (uint256(target) - 1));
    }
}
