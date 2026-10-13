// scripts/deploy_casino.cjs
// Deploy CasinoReserve and CasinoCore contracts with the deployed MatrixHubCoin address

const hre = require("hardhat");

async function main() {
  const MTX_ADDRESS = process.env.MTX_CONTRACT_ADDRESS;
  if (!MTX_ADDRESS || !hre.ethers.isAddress(MTX_ADDRESS) || /^0x0{40}$/i.test(MTX_ADDRESS)) {
    throw new Error("Set MTX_CONTRACT_ADDRESS to the deployed MTX contract address for the selected network.");
  }
  if (await hre.ethers.provider.getCode(MTX_ADDRESS) === "0x") {
    throw new Error("MTX_CONTRACT_ADDRESS has no deployed contract on the selected network.");
  }
  const [deployer] = await hre.ethers.getSigners();

  // Deploy CasinoReserve
  const reserveCap = hre.ethers.parseUnits("1000000", 18); // 1,000,000 MTX
  const CasinoReserve = await hre.ethers.getContractFactory("CasinoReserve");
  const reserve = await CasinoReserve.deploy(MTX_ADDRESS, reserveCap, deployer.address);
  await reserve.waitForDeployment();
  console.log("CasinoReserve deployed to:", reserve.target);

  // Deploy CasinoCore (dummy addresses for liquidity, rng, dev, governance for now)
  const CasinoCore = await hre.ethers.getContractFactory("CasinoCore");
  const dummy = deployer.address;
  const minBet = hre.ethers.parseUnits("1", 18);
  const maxBet = hre.ethers.parseUnits("1000", 18);
  const core = await CasinoCore.deploy(
    MTX_ADDRESS,
    dummy, // liquidity
    reserve.target,
    dummy, // rng
    minBet,
    maxBet,
    dummy, // dev
    dummy  // governance
  );
  await core.waitForDeployment();
  console.log("CasinoCore deployed to:", core.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
