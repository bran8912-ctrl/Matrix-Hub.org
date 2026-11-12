// Slots v1 tests — design: bot-core/go-live/next-casino-game-design.md
// (Nina Petrov, 2026-11-10). 3 reels x 20 stops, strip SEVENx1 BARx2
// BELLx3 PLUMx4 LEMONx4 CHERRYx6, paytable 100/100/40/25/15/12 + 1x for
// two CHERRY on reels 1-2 only. RTP 7,636/8,000 = 95.45%.
// Reel derivation: word % 20, (word / 20) % 20, (word / 400) % 20, so a
// word of r0 + 20*r1 + 400*r2 lands exactly on stops (r0, r1, r2).
const { expect } = require("chai");
const { ethers } = require("hardhat");

const wordFor = (r0, r1, r2) => r0 + 20 * r1 + 400 * r2;

// Independent JS mirror of the strip + paytable, written from the design
// doc (not from the Solidity) so the cross-check below is meaningful.
const STRIP = [
  "SEVEN",
  "BAR", "BAR",
  "BELL", "BELL", "BELL",
  "PLUM", "PLUM", "PLUM", "PLUM",
  "LEMON", "LEMON", "LEMON", "LEMON",
  "CHERRY", "CHERRY", "CHERRY", "CHERRY", "CHERRY", "CHERRY",
];
const THREE_OF_KIND = { SEVEN: 100, BAR: 100, BELL: 40, PLUM: 25, LEMON: 15, CHERRY: 12 };
function mirrorMultiplier(r0, r1, r2) {
  const [a, b, c] = [STRIP[r0], STRIP[r1], STRIP[r2]];
  if (a === b && b === c) return THREE_OF_KIND[a];
  if (a === "CHERRY" && b === "CHERRY") return 1;
  return 0;
}

describe("Casino Slots (CasinoCore.placeSlotsBet)", function () {
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
    const reserve = await Reserve.deploy(token.target, ethers.parseEther("1000"), ethers.ZeroAddress);
    const Coordinator = await ethers.getContractFactory("MockVRFCoordinator");
    const coordinator = await Coordinator.deploy();
    const RNG = await ethers.getContractFactory("RNGEngine");
    const rng = await RNG.deploy(coordinator.target, 1, ethers.id("test vrf key hash"), 250000, 3);
    const CasinoCore = await ethers.getContractFactory("CasinoCore");
    // Amoy parameters: min 1 / max 1000 MTX, max payout per bet 100 MTX.
    const core = await CasinoCore.deploy(
      token.target,
      liquidity.target,
      reserve.target,
      rng.target,
      ethers.parseEther("1"),
      ethers.parseEther("1000"),
      ethers.parseEther("100"),
      owner.address,
      owner.address
    );
    await liquidity.setCasinoCore(core.target);
    await reserve.setCasinoCore(core.target);
    await rng.setCasinoCore(core.target);
    return { owner, player, other, token, reserve, liquidity, core, rng, coordinator };
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

  async function spinAndSettle(fixture, word) {
    const { player, core, coordinator } = fixture;
    const betId = (await core.totalBets()) + 1n;
    const tx = await core.connect(player).placeSlotsBet(ethers.parseEther("1"));
    const receipt = await tx.wait();
    let requestId;
    for (const log of receipt.logs) {
      try {
        const parsed = core.interface.parseLog(log);
        if (parsed && parsed.name === "BetRequested") requestId = parsed.args[1];
      } catch { /* not a core log */ }
    }
    if (requestId === undefined) throw new Error("BetRequested event not found in receipt");
    await coordinator.fulfill(requestId, word);
    return betId;
  }

  it("computes the design RTP on-chain: slotsRtpBps() == 9545 (95.45%)", async function () {
    const fixture = await deployFixture();
    expect(await fixture.core.slotsRtpBps()).to.equal(9545n);
  });

  it("JS mirror of the design paytable also sums to 7,636 / 8,000", function () {
    let total = 0;
    let wins = 0;
    for (let a = 0; a < 20; a++)
      for (let b = 0; b < 20; b++)
        for (let c = 0; c < 20; c++) {
          const m = mirrorMultiplier(a, b, c);
          total += m;
          if (m > 0) wins++;
        }
    expect(total).to.equal(7636);
    expect(wins).to.equal(884); // 11.05% hit frequency
    expect((total * 10000) / 8000).to.equal(9545);
  });

  it("on-chain payout-for-word matches the JS mirror across sampled words", async function () {
    const fixture = await deployFixture();
    const { core } = fixture;
    const one = ethers.parseEther("1");
    // Deterministic spread of words, including every crafted case below.
    const words = [0, 421, 1263, 2526, 4210, 5894, 294, 5614, 1220];
    for (let w = 37; w < 8000; w += 389) words.push(w);
    for (const w of words) {
      const r0 = w % 20, r1 = Math.floor(w / 20) % 20, r2 = Math.floor(w / 400) % 20;
      const expected = BigInt(mirrorMultiplier(r0, r1, r2)) * one;
      expect(await core.slotsPayoutForWord(one, w), `word ${w}`).to.equal(expected);
    }
  });

  it("derives reels with word % 20, (word / 20) % 20, (word / 400) % 20", async function () {
    const fixture = await deployFixture();
    const reels = await fixture.core.slotsReelsFromWord(5894);
    expect([Number(reels[0]), Number(reels[1]), Number(reels[2])]).to.deep.equal([14, 14, 14]);
    // Higher bits beyond the 8,000-combination space do not change reels.
    const reels2 = await fixture.core.slotsReelsFromWord(5894 + 8000 * 12345);
    expect([Number(reels2[0]), Number(reels2[1]), Number(reels2[2])]).to.deep.equal([14, 14, 14]);
  });

  it("settles a three-CHERRY spin at 12x and pays through claimPayout", async function () {
    const fixture = await deployFixture();
    const { player, token, core } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = await spinAndSettle(fixture, wordFor(14, 14, 14));
    const bet = await core.getSlotsBet(betId);
    expect(bet.status).to.equal(2); // Settled
    expect(bet.win).to.equal(true);
    expect(bet.payout).to.equal(ethers.parseEther("12"));
    expect([Number(bet.reel0), Number(bet.reel1), Number(bet.reel2)]).to.deep.equal([14, 14, 14]);
    expect([Number(bet.symbol0), Number(bet.symbol1), Number(bet.symbol2)]).to.deep.equal([5, 5, 5]);
    expect(bet.multiplier).to.equal(12n);
    expect(await core.getBetGame(betId)).to.equal(1); // GAME_SLOTS
    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("12"));

    const before = await token.balanceOf(player.address);
    await core.connect(player).claimPayout(betId);
    expect((await token.balanceOf(player.address)) - before).to.equal(ethers.parseEther("12"));
    expect(await core.lockedPayouts()).to.equal(0);
    expect((await core.getSlotsBet(betId)).status).to.equal(3); // Claimed
  });

  it("settles the top prize (three SEVEN) at exactly the 100 MTX cap", async function () {
    const fixture = await deployFixture();
    const { player, token, core } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = await spinAndSettle(fixture, wordFor(0, 0, 0));
    const bet = await core.getSlotsBet(betId);
    expect(bet.win).to.equal(true);
    expect(bet.payout).to.equal(ethers.parseEther("100"));
    await core.connect(player).claimPayout(betId);
    expect(await token.balanceOf(player.address)).to.equal(ethers.parseEther("109"));
  });

  it("pays stake back (1x) for two CHERRY on reels 1-2 only", async function () {
    const fixture = await deployFixture();
    const { core } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = await spinAndSettle(fixture, wordFor(14, 15, 0)); // CHERRY, CHERRY, SEVEN
    const bet = await core.getSlotsBet(betId);
    expect(bet.win).to.equal(true);
    expect(bet.payout).to.equal(ethers.parseEther("1"));
    expect(bet.multiplier).to.equal(1n);
  });

  it("pays nothing for CHERRY on reels 1+3 without reel 2", async function () {
    const fixture = await deployFixture();
    const { core } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = await spinAndSettle(fixture, wordFor(14, 0, 14)); // CHERRY, SEVEN, CHERRY
    const bet = await core.getSlotsBet(betId);
    expect(bet.win).to.equal(false);
    expect(bet.payout).to.equal(0);
    await expect(core.connect(fixture.player).claimPayout(betId))
      .to.be.revertedWithCustomError(core, "BetNotClaimable");
  });

  it("settles a losing spin, releases the lock, and cannot be claimed", async function () {
    const fixture = await deployFixture();
    const { core, token, player } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const pendingId = (await core.totalBets()) + 1n;
    await core.connect(player).placeSlotsBet(ethers.parseEther("1"));
    expect(await core.lockedPayouts()).to.equal(ethers.parseEther("100"));
    const pending = await core.getSlotsBet(pendingId);
    expect(pending.status).to.equal(1); // Pending
    expect(Number(pending.symbol0)).to.equal(255); // not drawn yet

    const betId = await spinAndSettleLoss(fixture);
    expect(betId).to.equal(pendingId);
    const bet = await core.getSlotsBet(betId);
    expect(bet.status).to.equal(2);
    expect(bet.win).to.equal(false);
    expect(bet.payout).to.equal(0);
    expect(await core.lockedPayouts()).to.equal(0);
    expect(await core.activeRandomnessRequests()).to.equal(0);
    expect(await token.balanceOf(player.address)).to.equal(ethers.parseEther("9"));

    async function spinAndSettleLoss(fx) {
      // The bet above is already placed; fulfil its request (id == betId
      // in this fixture's mock sequence) with a losing word.
      await fx.coordinator.fulfill(pendingId, wordFor(0, 1, 3)); // SEVEN, BAR, BELL
      return pendingId;
    }
  });

  it("reverts a 2 MTX spin with ExceedsMaxPayout (100x worst case > 100 MTX cap)", async function () {
    const fixture = await deployFixture();
    const { core, player } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));
    await expect(core.connect(player).placeSlotsBet(ethers.parseEther("2")))
      .to.be.revertedWithCustomError(core, "ExceedsMaxPayout");
  });

  it("reverts below-minimum and above-maximum spins", async function () {
    const fixture = await deployFixture();
    const { core, player } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));
    await expect(core.connect(player).placeSlotsBet(ethers.parseEther("0.5")))
      .to.be.revertedWithCustomError(core, "BetBelowMinimum");
    await expect(core.connect(player).placeSlotsBet(ethers.parseEther("1001")))
      .to.be.revertedWithCustomError(core, "BetAboveMaximum");
  });

  it("reverts when the worst-case payout exceeds reserve headroom", async function () {
    const fixture = await deployFixture();
    const { core, player } = fixture;
    await fundReserve(fixture, ethers.parseEther("50")); // < 100 MTX worst case
    await fundPlayer(fixture, ethers.parseEther("10"));
    await expect(core.connect(player).placeSlotsBet(ethers.parseEther("1")))
      .to.be.revertedWithCustomError(core, "MaxPayoutExceedsReserve");
  });

  it("refunds a stuck Slots spin in full after the 1-hour timeout", async function () {
    const fixture = await deployFixture();
    const { core, token, player, owner } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = (await core.totalBets()) + 1n;
    await core.connect(player).placeSlotsBet(ethers.parseEther("1"));
    await expect(core.refundStuckBet(betId)).to.be.revertedWithCustomError(core, "RefundTooEarly");

    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    const before = await token.balanceOf(player.address);
    await core.connect(owner).refundStuckBet(betId);
    expect((await token.balanceOf(player.address)) - before).to.equal(ethers.parseEther("1"));
    expect((await core.getSlotsBet(betId)).status).to.equal(4); // Refunded
    expect(await core.lockedPayouts()).to.equal(0);
    expect(await core.activeRandomnessRequests()).to.equal(0);
  });

  it("pause blocks new Slots spins but never blocks claims", async function () {
    const fixture = await deployFixture();
    const { core, player } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));

    const betId = await spinAndSettle(fixture, wordFor(14, 14, 14));
    await core.setPaused(true);
    await expect(core.connect(player).placeSlotsBet(ethers.parseEther("1")))
      .to.be.revertedWithCustomError(core, "CasinoPaused");
    await core.connect(player).claimPayout(betId); // claim still works
    expect((await core.getSlotsBet(betId)).status).to.equal(3);
    await core.setPaused(false);
  });

  it("routes the stake like Dice: 92% reserve / 6% liquidity / 2% dev", async function () {
    const fixture = await deployFixture();
    const { core, player, reserve, liquidity, token, owner } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("10"));
    const reserveBefore = await reserve.reserveBalance();
    const devBefore = await token.balanceOf(owner.address);
    await core.connect(player).placeSlotsBet(ethers.parseEther("1"));
    expect((await reserve.reserveBalance()) - reserveBefore).to.equal(ethers.parseEther("0.92"));
    expect(await liquidity.pendingMtx()).to.equal(ethers.parseEther("0.06"));
    expect((await token.balanceOf(owner.address)) - devBefore).to.equal(ethers.parseEther("0.02"));
  });

  it("keeps Dice working alongside Slots on the same core", async function () {
    const fixture = await deployFixture();
    const { core, player, coordinator } = fixture;
    await fundReserve(fixture, ethers.parseEther("500"));
    await fundPlayer(fixture, ethers.parseEther("20"));

    await core.connect(player).placeDiceBet(ethers.parseEther("10"), 50);
    await coordinator.fulfill(1, 48); // roll 49 < 50 -> win 20
    const diceBet = await core.getBet(1);
    expect(diceBet.win).to.equal(true);
    expect(diceBet.payout).to.equal(ethers.parseEther("20"));
    expect(await core.getBetGame(1)).to.equal(0); // GAME_DICE
    await expect(core.getSlotsBet(1)).to.be.revertedWithCustomError(core, "BetNotFound");
  });
});
