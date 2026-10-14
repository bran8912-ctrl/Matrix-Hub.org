const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Casino VRF settlement and reserve accounting", function () {
  async function deployFixture() {
    const [owner, player, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockLiquidityToken");
    const token = await Token.deploy();
    const wrappedNative = await Token.deploy();
    const QuickSwapRouter = await ethers.getContractFactory("MockQuickSwapV2Router");
    const quickSwapRouter = await QuickSwapRouter.deploy(wrappedNative.target);
    const LiquidityRouter = await ethers.getContractFactory("LiquidityRouter");
    const liquidity = await LiquidityRouter.deploy(token.target, quickSwapRouter.target);
    const Reserve = await ethers.getContractFactory("CasinoReserve");
    const reserveCap = ethers.parseEther("1000");
    const reserve = await Reserve.deploy(token.target, reserveCap, ethers.ZeroAddress);
    const Coordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const coordinator = await Coordinator.deploy();
    const RNG = await ethers.getContractFactory("RNGEngine");
    const keyHash = ethers.id("test vrf key hash");
    const rng = await RNG.deploy(coordinator.target, 1, keyHash, 250000, 3);
    const CasinoCore = await ethers.getContractFactory("CasinoCore");
    const core = await CasinoCore.deploy(
      token.target,
      liquidity.target,
      reserve.target,
      rng.target,
      ethers.parseEther("0.01"),
      ethers.parseEther("100"),
      ethers.parseEther("100"),
      owner.address,
      owner.address
    );
    await liquidity.setCasinoCore(core.target);
    await reserve.setCasinoCore(core.target);
    await rng.setCasinoCore(core.target);

    return { owner, player, other, token, reserveCap, reserve, liquidity, core, rng, coordinator, keyHash };
  }

  async function fundReserve(fixture, amount) {
    const { owner, token, reserve } = fixture;
    await token.mint(owner.address, amount);
    await token.approve(reserve.target, amount);
    await reserve.fund(amount);
  }

  async function fundPlayer(fixture, amount) {
    const { player, token, core } = fixture;
    await token.mint(player.address, amount);
    await token.connect(player).approve(core.target, amount);
  }

  it("pulls and accounts owner-provided reserve funding", async function () {
    const fixture = await deployFixture();
    const { owner, player, token, reserveCap, reserve } = fixture;
    const amount = ethers.parseEther("100");

    await token.mint(owner.address, reserveCap + amount);
    await token.approve(reserve.target, reserveCap + amount);
    await reserve.fund(amount);

    expect(await reserve.reserveBalance()).to.equal(amount);
    expect(await token.balanceOf(reserve.target)).to.equal(amount);
    await expect(reserve.connect(player).fund(1))
      .to.be.revertedWithCustomError(reserve, "NotAuthorized");
    await expect(reserve.fund(reserveCap))
      .to.be.revertedWithCustomError(reserve, "ExceedsReserveCap");
  });

  it("holds the worst-case payout and waits for VRF before settling and claiming", async function () {
    const fixture = await deployFixture();
    const { player, token, reserve, liquidity, core, coordinator, keyHash } = fixture;
    const seed = ethers.parseEther("100");
    const amount = ethers.parseEther("10");

    await fundReserve(fixture, seed);
    await fundPlayer(fixture, amount);

    await expect(core.connect(player).placeDiceBet(amount, 50))
      .to.emit(core, "BetRequested")
      .withArgs(1, 1, player.address, ethers.parseEther("20"));

    expect(await core.activeRandomnessRequests()).to.equal(1);
    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("20"));
    expect(await reserve.reserveBalance()).to.equal(ethers.parseEther("109.2"));
    expect(await token.balanceOf(player.address)).to.equal(0);
    expect(await liquidity.pendingMtx()).to.equal(ethers.parseEther("0.6"));

    const request = await coordinator.getRequest(1);
    expect(request.subId).to.equal(1);
    expect(request.keyHash).to.equal(keyHash);
    expect(request.requestConfirmations).to.equal(3);
    expect(request.callbackGasLimit).to.equal(250000);
    expect(request.numWords).to.equal(1);

    await expect(core.connect(fixture.other).fulfillRandomness(1, 48))
      .to.be.revertedWithCustomError(core, "NotRng");
    await coordinator.fulfill(1, 48);

    const settledBet = await core.getBet(1);
    expect(settledBet.roll).to.equal(49);
    expect(settledBet.status).to.equal(2);
    expect(settledBet.win).to.equal(true);
    expect(settledBet.payout).to.equal(ethers.parseEther("20"));
    expect(await core.activeRandomnessRequests()).to.equal(0);
    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("20"));
    expect(await token.balanceOf(player.address)).to.equal(0);

    await expect(core.connect(fixture.other).claimPayout(1))
      .to.be.revertedWithCustomError(core, "NotBetPlayer");
    await core.connect(player).claimPayout(1);

    expect(await token.balanceOf(player.address)).to.equal(ethers.parseEther("20"));
    expect(await reserve.reserveBalance()).to.equal(ethers.parseEther("89.2"));
    expect(await core.lockedPayouts()).to.equal(0);
    expect((await core.getBet(1)).status).to.equal(3);
  });

  it("releases reserved payout capacity after a losing VRF result", async function () {
    const fixture = await deployFixture();
    const { player, core, coordinator } = fixture;
    const amount = ethers.parseEther("10");

    await fundReserve(fixture, ethers.parseEther("100"));
    await fundPlayer(fixture, amount);
    await core.connect(player).placeDiceBet(amount, 50);

    await coordinator.fulfill(1, 49);

    const bet = await core.getBet(1);
    expect(bet.roll).to.equal(50);
    expect(bet.status).to.equal(2);
    expect(bet.win).to.equal(false);
    expect(bet.payout).to.equal(0);
    expect(await core.lockedPayouts()).to.equal(0);
    await expect(core.connect(player).claimPayout(1))
      .to.be.revertedWithCustomError(core, "BetNotClaimable");
  });

  it("prevents concurrent bets from overcommitting the reserve", async function () {
    const fixture = await deployFixture();
    const { player, core } = fixture;
    const seed = ethers.parseEther("25");
    const firstBet = ethers.parseEther("0.25");
    const secondBet = ethers.parseEther("0.01");

    await fundReserve(fixture, seed);
    await fundPlayer(fixture, firstBet + secondBet);
    await core.connect(player).placeDiceBet(firstBet, 2);

    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("24.5"));
    await expect(core.connect(player).placeDiceBet(secondBet, 2))
      .to.be.revertedWithCustomError(core, "MaxPayoutExceedsReserve");
  });

  it("rejects invalid targets and keeps the existing reserve liability intact", async function () {
    const fixture = await deployFixture();
    const { player, core } = fixture;
    const amount = ethers.parseEther("1");

    await fundReserve(fixture, ethers.parseEther("100"));
    await fundPlayer(fixture, amount);
    await expect(core.connect(player).placeDiceBet(amount, 1))
      .to.be.revertedWithCustomError(core, "InvalidTarget");
    await expect(core.connect(player).placeDiceBet(amount, 99))
      .to.be.revertedWithCustomError(core, "InvalidTarget");
    expect(await core.totalBets()).to.equal(0);
    expect(await core.lockedPayouts()).to.equal(0);
  });
});
