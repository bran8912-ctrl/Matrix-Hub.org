const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityRouter with QuickSwap V2", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockLiquidityToken");
    const token = await Token.deploy();
    const wrappedNative = await Token.deploy();
    const QuickSwapRouter = await ethers.getContractFactory("MockQuickSwapV2Router");
    const quickSwapRouter = await QuickSwapRouter.deploy(wrappedNative.target);
    const LiquidityRouter = await ethers.getContractFactory("LiquidityRouter");
    const liquidityRouter = await LiquidityRouter.deploy(token.target, quickSwapRouter.target);
    const CasinoCore = await ethers.getContractFactory("MockCasinoCore");
    const casinoCore = await CasinoCore.deploy();
    await liquidityRouter.setCasinoCore(casinoCore.target);

    return { owner, other, token, wrappedNative, quickSwapRouter, liquidityRouter, casinoCore };
  }

  async function queueMtx(fixture, amount) {
    const { token, liquidityRouter, casinoCore } = fixture;
    await token.mint(casinoCore.target, amount);
    await casinoCore.depositLiquidity(token.target, liquidityRouter.target, amount);
  }

  it("requires valid MTX and QuickSwap V2 contracts", async function () {
    const [owner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockLiquidityToken");
    const token = await Token.deploy();
    const QuickSwapRouter = await ethers.getContractFactory("MockQuickSwapV2Router");
    const LiquidityRouter = await ethers.getContractFactory("LiquidityRouter");

    await expect(
      LiquidityRouter.deploy(token.target, owner.address)
    ).to.be.revertedWithCustomError(LiquidityRouter, "InvalidContract");

    const wrappedNative = await Token.deploy();
    const quickSwapRouter = await QuickSwapRouter.deploy(wrappedNative.target);
    const liquidityRouter = await LiquidityRouter.deploy(token.target, quickSwapRouter.target);

    expect(await liquidityRouter.WRAPPED_NATIVE()).to.equal(wrappedNative.target);
  });

  it("accepts queued MTX only from the configured CasinoCore", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("10");

    await queueMtx(fixture, amount);
    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(amount);
    expect(await fixture.token.balanceOf(fixture.liquidityRouter.target)).to.equal(amount);
    await expect(
      fixture.liquidityRouter.connect(fixture.other).depositLiquidity(1)
    ).to.be.revertedWithCustomError(fixture.liquidityRouter, "NotCasinoCore");
  });

  it("lets the owner queue the initial MTX needed to create a new pair", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("1000");

    await fixture.token.mint(fixture.owner.address, amount);
    await fixture.token.approve(fixture.liquidityRouter.target, amount);
    await fixture.liquidityRouter.queueInitialLiquidity(amount);

    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(amount);
    expect(await fixture.token.balanceOf(fixture.liquidityRouter.target)).to.equal(amount);
    await expect(
      fixture.liquidityRouter.connect(fixture.other).queueInitialLiquidity(1)
    ).to.be.revertedWithCustomError(fixture.liquidityRouter, "OwnableUnauthorizedAccount");
  });

  it("lets the owner provide queued MTX and MATIC through QuickSwap V2", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("10");
    const nativeUsed = ethers.parseEther("2");
    const nativeSent = ethers.parseEther("3");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;

    await queueMtx(fixture, amount);
    await fixture.quickSwapRouter.setNativeAmountToUse(nativeUsed);
    await expect(
      fixture.liquidityRouter.provideLiquidity(
        amount,
        amount,
        nativeUsed,
        deadline,
        { value: nativeSent }
      )
    )
      .to.emit(fixture.liquidityRouter, "LiquidityProvided")
      .withArgs(fixture.owner.address, fixture.owner.address, amount, nativeUsed, nativeUsed);

    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(0);
    const quickSwapAddress = await fixture.quickSwapRouter.getAddress();
    expect(await fixture.token.balanceOf(quickSwapAddress)).to.equal(amount);
    expect(await fixture.token.allowance(fixture.liquidityRouter.target, fixture.quickSwapRouter.target)).to.equal(0);
    expect(await ethers.provider.getBalance(fixture.liquidityRouter.target)).to.equal(0);
  });

  it("keeps unused MTX pending when QuickSwap uses less than desired", async function () {
    const fixture = await deployFixture();
    const desired = ethers.parseEther("10");
    const tokenUsed = ethers.parseEther("6");
    const nativeUsed = ethers.parseEther("2");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;

    await queueMtx(fixture, desired);
    await fixture.quickSwapRouter.setNativeAmountToUse(nativeUsed);
    await fixture.quickSwapRouter.setTokenAmountToUse(tokenUsed);
    await fixture.liquidityRouter.provideLiquidity(
      desired,
      tokenUsed,
      nativeUsed,
      deadline,
      { value: nativeUsed }
    );

    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(desired - tokenUsed);
    expect(await fixture.token.balanceOf(fixture.liquidityRouter.target)).to.equal(desired - tokenUsed);
  });

  it("does not let non-owners provide liquidity or withdraw queued tokens", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("1");

    await queueMtx(fixture, amount);
    await expect(
      fixture.liquidityRouter.connect(fixture.other).provideLiquidity(
        amount,
        0,
        0,
        (await ethers.provider.getBlock("latest")).timestamp + 60,
        { value: 1 }
      )
    ).to.be.revertedWithCustomError(fixture.liquidityRouter, "OwnableUnauthorizedAccount");
    await expect(
      fixture.liquidityRouter.connect(fixture.other).withdrawPendingMtx(fixture.other.address, amount)
    ).to.be.revertedWithCustomError(fixture.liquidityRouter, "OwnableUnauthorizedAccount");
  });

  it("preserves pending MTX when liquidity bounds are not met", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("1");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;

    await queueMtx(fixture, amount);
    await expect(
      fixture.liquidityRouter.provideLiquidity(amount, amount, 2, deadline, { value: 1 })
    ).to.be.revertedWith("INSUFFICIENT_NATIVE_AMOUNT");
    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(amount);
    expect(await fixture.token.allowance(fixture.liquidityRouter.target, fixture.quickSwapRouter.target)).to.equal(0);
  });

  it("allows the owner to recover queued MTX", async function () {
    const fixture = await deployFixture();
    const amount = ethers.parseEther("1");

    await queueMtx(fixture, amount);
    await fixture.liquidityRouter.withdrawPendingMtx(fixture.other.address, amount);

    expect(await fixture.liquidityRouter.pendingMtx()).to.equal(0);
    expect(await fixture.token.balanceOf(fixture.other.address)).to.equal(amount);
  });
});
