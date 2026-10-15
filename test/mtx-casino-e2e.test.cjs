const { expect } = require("chai");
const { ethers } = require("hardhat");

// Mirrors the module-link checks performed by CasinoConnectionTest.astro against
// the real MatrixHubCoin token and the full casino stack on a local chain.
describe("MTX + casino end-to-end (local)", function () {
  it("deploys, links, bets, settles and pays out with real MTX", async function () {
    const [owner, player] = await ethers.getSigners();

    const MTX = await ethers.getContractFactory("MatrixHubCoin");
    const mtx = await MTX.deploy(100000000, owner.address);

    const Token = await ethers.getContractFactory("MockLiquidityToken");
    const wrapped = await Token.deploy();
    const QuickSwap = await ethers.getContractFactory("MockQuickSwapV2Router");
    const quickSwap = await QuickSwap.deploy(wrapped.target);
    const Liquidity = await ethers.getContractFactory("LiquidityRouter");
    const liquidity = await Liquidity.deploy(mtx.target, quickSwap.target);
    const Reserve = await ethers.getContractFactory("CasinoReserve");
    const reserve = await Reserve.deploy(mtx.target, ethers.parseEther("1000"), ethers.ZeroAddress);
    const Coordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const coordinator = await Coordinator.deploy();
    const RNG = await ethers.getContractFactory("RNGEngine");
    const rng = await RNG.deploy(coordinator.target, 1, ethers.id("key"), 250000, 3);
    const Core = await ethers.getContractFactory("CasinoCore");
    const core = await Core.deploy(
      mtx.target, liquidity.target, reserve.target, rng.target,
      ethers.parseEther("1"), ethers.parseEther("1000"), ethers.parseEther("100"),
      owner.address, owner.address
    );
    await reserve.setCasinoCore(core.target);
    await rng.setCasinoCore(core.target);
    await liquidity.setCasinoCore(core.target);

    // Same getters the browser diagnostic reads
    expect(await core.mtx()).to.equal(mtx.target);
    expect(await core.reserve()).to.equal(reserve.target);
    expect(await core.liquidity()).to.equal(liquidity.target);
    expect(await core.rng()).to.equal(rng.target);
    expect(await reserve.mtx()).to.equal(mtx.target);
    expect(await reserve.casinoCore()).to.equal(core.target);
    expect(await liquidity.MTX()).to.equal(mtx.target);
    expect(await liquidity.casinoCore()).to.equal(core.target);
    expect(await rng.casinoCore()).to.equal(core.target);
    expect(await core.minBet()).to.equal(ethers.parseEther("1"));

    // Player buys MTX with native currency; owner funds the reserve
    await player.sendTransaction({ to: mtx.target, value: ethers.parseEther("1") });
    expect(await mtx.balanceOf(player.address)).to.equal(ethers.parseEther("1000"));
    await mtx.mintToEcosystem(owner.address, ethers.parseEther("500"));
    await mtx.approve(reserve.target, ethers.parseEther("500"));
    await reserve.fund(ethers.parseEther("500"));

    const bet = ethers.parseEther("10");
    await mtx.connect(player).approve(core.target, bet);
    await core.connect(player).placeDiceBet(bet, 50);
    await coordinator.fulfill(1, 48);

    const settled = await core.getBet(1);
    expect(settled.win).to.equal(true);
    const before = await mtx.balanceOf(player.address);
    await core.connect(player).claimPayout(1);
    expect((await mtx.balanceOf(player.address)) - before).to.equal(settled.payout);
  });
});
