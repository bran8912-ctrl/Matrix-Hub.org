const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// G-03 (multisig governance + capped emergencyWithdraw) and G-04 (stuck-bet
// refund) for CasinoCore / CasinoReserve. Governance is a distinct signer
// standing in for the Safe multisig: the contracts only check
// msg.sender == governance, so any address works as the mechanism test.
describe("Casino governance and stuck-bet refund (G-03 / G-04)", function () {
  async function deployFixture() {
    const [owner, gov, dev, player, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockLiquidityToken");
    const token = await Token.deploy();
    const wrappedNative = await Token.deploy();
    const QuickSwapRouter = await ethers.getContractFactory("MockQuickSwapV2Router");
    const quickSwapRouter = await QuickSwapRouter.deploy(wrappedNative.target);
    const LiquidityRouter = await ethers.getContractFactory("LiquidityRouter");
    const liquidity = await LiquidityRouter.deploy(token.target, quickSwapRouter.target);
    const Reserve = await ethers.getContractFactory("CasinoReserve");
    const reserve = await Reserve.deploy(token.target, ethers.parseEther("1000"), ethers.ZeroAddress);
    const Coordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const coordinator = await Coordinator.deploy();
    const RNG = await ethers.getContractFactory("RNGEngine");
    const rng = await RNG.deploy(coordinator.target, 1, ethers.id("test vrf key hash"), 250000, 3);
    const CasinoCore = await ethers.getContractFactory("CasinoCore");
    const core = await CasinoCore.deploy(
      token.target,
      liquidity.target,
      reserve.target,
      rng.target,
      ethers.parseEther("0.01"),
      ethers.parseEther("100"),
      ethers.parseEther("100"),
      dev.address,
      gov.address
    );
    await liquidity.setCasinoCore(core.target);
    await reserve.setCasinoCore(core.target);
    await rng.setCasinoCore(core.target);

    return { owner, gov, dev, player, other, token, reserve, liquidity, core, rng, coordinator };
  }

  async function fundReserve(fixture, amount) {
    const { owner, token, reserve } = fixture;
    await token.mint(owner.address, amount);
    await token.approve(reserve.target, amount);
    await reserve.fund(amount);
  }

  async function placeBet(fixture, amount, target) {
    const { player, token, core } = fixture;
    await token.mint(player.address, amount);
    await token.connect(player).approve(core.target, amount);
    await core.connect(player).placeDiceBet(amount, target);
  }

  it("defaults the emergency-withdraw cap to 100 MTX and the refund timeout to 1 hour", async function () {
    const { core } = await deployFixture();
    expect(await core.maxEmergencyWithdraw()).to.equal(ethers.parseEther("100"));
    expect(await core.DEFAULT_MAX_EMERGENCY_WITHDRAW()).to.equal(ethers.parseEther("100"));
    expect(await core.STUCK_BET_REFUND_TIMEOUT()).to.equal(3600);
  });

  it("lets only the configured governance address use the governance setters", async function () {
    const { owner, gov, other, core } = await deployFixture();

    await expect(core.connect(owner).setPaused(true))
      .to.be.revertedWithCustomError(core, "NotGovernance");
    await expect(core.connect(other).setPaused(true))
      .to.be.revertedWithCustomError(core, "NotGovernance");

    await expect(core.connect(gov).setPaused(true))
      .to.emit(core, "PauseChanged")
      .withArgs(true);
    expect(await core.paused()).to.equal(true);
    await core.connect(gov).setPaused(false);
    expect(await core.paused()).to.equal(false);
  });

  it("emits events when governance and dev move, and the new governance takes over", async function () {
    const { gov, dev, other, core } = await deployFixture();

    await expect(core.connect(gov).setDev(other.address))
      .to.emit(core, "DevUpdated")
      .withArgs(dev.address, other.address);
    expect(await core.dev()).to.equal(other.address);

    await expect(core.connect(gov).setGovernance(other.address))
      .to.emit(core, "GovernanceUpdated")
      .withArgs(gov.address, other.address);
    expect(await core.governance()).to.equal(other.address);

    await expect(core.connect(gov).setPaused(true))
      .to.be.revertedWithCustomError(core, "NotGovernance");
    await core.connect(other).setPaused(true);
    expect(await core.paused()).to.equal(true);
  });

  it("caps emergencyWithdraw per call, emits an event, and lets governance move the cap", async function () {
    const { owner, gov, other, token, core } = await deployFixture();

    await expect(core.connect(other).emergencyWithdraw(other.address, 1))
      .to.be.revertedWithCustomError(core, "NotGovernance");

    await token.mint(owner.address, ethers.parseEther("50"));
    await token.connect(owner).transfer(core.target, ethers.parseEther("50"));
    await expect(core.connect(gov).emergencyWithdraw(other.address, ethers.parseEther("50")))
      .to.emit(core, "EmergencyWithdrawal")
      .withArgs(other.address, ethers.parseEther("50"));
    expect(await token.balanceOf(other.address)).to.equal(ethers.parseEther("50"));

    await token.mint(owner.address, ethers.parseEther("150"));
    await token.connect(owner).transfer(core.target, ethers.parseEther("150"));
    await expect(core.connect(gov).emergencyWithdraw(other.address, ethers.parseEther("150")))
      .to.be.revertedWithCustomError(core, "EmergencyWithdrawExceedsCap");

    await expect(core.connect(gov).setMaxEmergencyWithdraw(ethers.parseEther("200")))
      .to.emit(core, "MaxEmergencyWithdrawUpdated")
      .withArgs(ethers.parseEther("100"), ethers.parseEther("200"));
    await core.connect(gov).emergencyWithdraw(other.address, ethers.parseEther("150"));
    expect(await token.balanceOf(other.address)).to.equal(ethers.parseEther("200"));
  });

  it("transfers CasinoReserve ownership to governance (deploy-script step)", async function () {
    const { owner, gov, player, token, reserve } = await deployFixture();

    await expect(reserve.connect(player).transferOwnership(gov.address))
      .to.be.revertedWithCustomError(reserve, "NotAuthorized");
    await expect(reserve.transferOwnership(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(reserve, "ZeroAddress");

    await expect(reserve.transferOwnership(gov.address))
      .to.emit(reserve, "OwnershipTransferred")
      .withArgs(owner.address, gov.address);
    expect(await reserve.owner()).to.equal(gov.address);

    // Old owner can no longer fund; the new owner can.
    await token.mint(owner.address, ethers.parseEther("10"));
    await token.connect(owner).approve(reserve.target, ethers.parseEther("10"));
    await expect(reserve.fund(ethers.parseEther("10")))
      .to.be.revertedWithCustomError(reserve, "NotAuthorized");
    await token.mint(gov.address, ethers.parseEther("10"));
    await token.connect(gov).approve(reserve.target, ethers.parseEther("10"));
    await reserve.connect(gov).fund(ethers.parseEther("10"));
    expect(await reserve.reserveBalance()).to.equal(ethers.parseEther("10"));
  });

  it("refunds a stuck bet in full after the 1-hour timeout", async function () {
    const fixture = await deployFixture();
    const { gov, player, token, reserve, core, coordinator } = fixture;
    const bet = ethers.parseEther("10");

    await fundReserve(fixture, ethers.parseEther("100"));
    await placeBet(fixture, bet, 50);
    expect(await token.balanceOf(player.address)).to.equal(0);
    expect(await core.activeRandomnessRequests()).to.equal(1);
    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("20"));

    const placedAt = await time.latest();
    expect(await core.refundableAt(1)).to.equal(BigInt(placedAt) + 3600n);

    await time.increase(3601);
    await expect(core.connect(gov).refundStuckBet(1))
      .to.emit(core, "BetRefunded")
      .withArgs(1, player.address, bet);

    expect(await token.balanceOf(player.address)).to.equal(bet);
    expect(await core.activeRandomnessRequests()).to.equal(0);
    expect(await core.lockedPayouts()).to.equal(0);
    // 100 funded + 9.2 routed from the bet - 10 refunded in full.
    expect(await reserve.reserveBalance()).to.equal(ethers.parseEther("99.2"));
    expect((await core.getBet(1)).status).to.equal(4); // Refunded

    // A late VRF callback for the refunded bet is a harmless no-op.
    await coordinator.fulfill(1, 48);
    expect((await core.getBet(1)).status).to.equal(4);

    await expect(core.connect(player).claimPayout(1))
      .to.be.revertedWithCustomError(core, "BetNotClaimable");
  });

  it("refuses a refund before the timeout", async function () {
    const fixture = await deployFixture();
    const { gov, core } = fixture;

    await fundReserve(fixture, ethers.parseEther("100"));
    await placeBet(fixture, ethers.parseEther("10"), 50);

    await expect(core.connect(gov).refundStuckBet(1))
      .to.be.revertedWithCustomError(core, "RefundTooEarly");
    // 3500s in (each mined block also advances ~1s, so stay well clear of
    // the 3600s boundary): still too early.
    await time.increase(3500);
    await expect(core.connect(gov).refundStuckBet(1))
      .to.be.revertedWithCustomError(core, "RefundTooEarly");
    await time.increase(200);
    await core.connect(gov).refundStuckBet(1);
    expect((await core.getBet(1)).status).to.equal(4);
  });

  it("refuses a refund for settled bets, refunded bets, and unknown bets", async function () {
    const fixture = await deployFixture();
    const { gov, core, coordinator } = fixture;

    await expect(core.connect(gov).refundStuckBet(99))
      .to.be.revertedWithCustomError(core, "BetNotFound");
    await expect(core.refundableAt(99))
      .to.be.revertedWithCustomError(core, "BetNotFound");

    await fundReserve(fixture, ethers.parseEther("100"));
    await placeBet(fixture, ethers.parseEther("10"), 50);
    await coordinator.fulfill(1, 48); // settled win
    await time.increase(3601);
    await expect(core.connect(gov).refundStuckBet(1))
      .to.be.revertedWithCustomError(core, "BetNotRefundable");

    // Second bet: refund once, then a second refund reverts.
    await placeBet(fixture, ethers.parseEther("10"), 50);
    await time.increase(3601);
    await core.connect(gov).refundStuckBet(2);
    await expect(core.connect(gov).refundStuckBet(2))
      .to.be.revertedWithCustomError(core, "BetNotRefundable");
  });

  it("lets only governance refund a stuck bet", async function () {
    const fixture = await deployFixture();
    const { player, other, gov, core } = fixture;

    await fundReserve(fixture, ethers.parseEther("100"));
    await placeBet(fixture, ethers.parseEther("10"), 50);
    await time.increase(3601);

    await expect(core.connect(player).refundStuckBet(1))
      .to.be.revertedWithCustomError(core, "NotGovernance");
    await expect(core.connect(other).refundStuckBet(1))
      .to.be.revertedWithCustomError(core, "NotGovernance");
    await core.connect(gov).refundStuckBet(1);
    expect((await core.getBet(1)).status).to.equal(4);
  });
});
