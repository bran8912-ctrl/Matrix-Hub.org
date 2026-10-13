// Deploy CasinoReserve on Amoy via injected MetaMask
const { ethers } = require("ethers");

(async () => {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddr = await signer.getAddress();
    console.log("Deploying from:", signerAddr);
    const network = await provider.getNetwork();
    if (network.chainId !== 80002n) throw new Error("Connect to Polygon Amoy (chain ID 80002) before deploying.");

    const bytecode = "0x608060405234801561000f575f5ffd5b506040516104fe3803806104fe83398101604081905261002e916100ed565b6001600160a01b0383166100555760405163d92e233d60e01b815260040160405180910390fd5b6001600160a01b03811661007c5760405163d92e233d60e01b815260040160405180910390fd5b815f0361009c57604051631f2a200560e01b815260040160405180910390fd5b5f80546001600160a01b039485166001600160a01b03199182161790915560029290925560038054919093169116179055610126565b80516001600160a01b03811681146100e8575f5ffd5b919050565b5f5f5f606084860312156100ff575f5ffd5b610108846100d2565b92506020840151915061011d604085016100d2565b90509250925092565b6103cb806101335f395ff3fe608060405234801561000f575f5ffd5b506004361061007a575f3560e01c80636cc88dbb116100585780636cc88dbb146100b7578063a10954fe146100e2578063ab314699146100eb578063b6b55f25146100fd575f5ffd5b80632223a5da1461007e5780633a35ba031461009a5780634e958d05146100a2575f5ffd5b61008760025481565b6040519081526020015b60405180910390f35b600154610087565b6100b56100b03660046102e3565b610110565b005b6003546100ca906001600160a01b031681565b6040516001600160a01b039091168152602001610091565b61008760015481565b5f546100ca906001600160a01b031681565b6100b561010b366004610318565b61024f565b6003546001600160a01b0316331461013b5760405163ea8e4eb560e01b815260040160405180910390fd5b6001600160a01b0382166101625760405163d92e233d60e01b815260040160405180910390fd5b805f0361018257604051631f2a200560e01b815260040160405180910390fd5b8060015410156101a5576040516328b35f2160e01b815260040160405180910390fd5b8060015f8282546101b69190610343565b90915550505f5460405163a9059cbb60e01b81526001600160a01b038481166004830152602482018490529091169063a9059cbb906044016020604051808303815f875af115801561020a573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061022e919061035c565b61024b57604051632383712b60e01b815260040160405180910390fd5b5050565b6003546001600160a01b0316331461027a5760405163ea8e4eb560e01b815260040160405180910390fd5b805f0361029a57604051631f2a200560e01b815260040160405180910390fd5b600254816001546102ab9190610382565b11156102ca5760405163ed1d55e560e01b815260040160405180910390fd5b8060015f8282546102db9190610382565b909155505050565b5f5f604083850312156102f4575f5ffd5b82356001600160a01b038116811461030a575f5ffd5b946020939093013593505050565b5f60208284031215610328575f5ffd5b5035919050565b634e487b7160e01b5f52601160045260245ffd5b818103818111156103565761035661032f565b92915050565b5f6020828403121561036c575f5ffd5b8151801515811461037b575f5ffd5b9392505050565b808201808211156103565761035661032f56fea26469706673582212203f9393413516bb850c2e9e0cc438055a530fb645844365ab65c5d41ea55251fb64736f6c634300081f0033";

    const abi = [
      "constructor(address _mtx, uint256 _reserveCap, address _casinoCore)",
      "function mtx() view returns (address)",
      "function reserveBalance() view returns (uint256)",
      "function reserveCap() view returns (uint256)",
      "function casinoCore() view returns (address)"
    ];

    const factory = new ethers.ContractFactory(abi, bytecode, signer);

    const _mtx = window.prompt("Enter the deployed MTX contract address on Amoy")?.trim();
    const _reserveCap = 1000000000000000000000000n;
    const _casinoCore = window.prompt("Enter the deployed CasinoCore address on Amoy")?.trim();
    if (![[_mtx, "MTX"], [_casinoCore, "CasinoCore"]].every(([address]) =>
      ethers.isAddress(address) && address.toLowerCase() !== ethers.ZeroAddress.toLowerCase()
    )) {
      throw new Error("Enter valid, non-zero Amoy contract addresses.");
    }
    if (await provider.getCode(_mtx) === "0x" || await provider.getCode(_casinoCore) === "0x") {
      throw new Error("Both addresses must contain deployed contracts on Amoy.");
    }

    console.log("Deploying CasinoReserve with params:");
    console.log("  _mtx:", _mtx);
    console.log("  _reserveCap:", _reserveCap.toString());
    console.log("  _casinoCore:", _casinoCore);

    const contract = await factory.deploy(_mtx, _reserveCap, _casinoCore);
    console.log("Transaction hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log("CasinoReserve deployed at:", address);

    // Verify constructor
    console.log("\n--- Verification ---");
    console.log("mtx():", await contract.mtx());
    console.log("reserveCap():", (await contract.reserveCap()).toString());
    console.log("casinoCore():", await contract.casinoCore());
    console.log("reserveBalance():", (await contract.reserveBalance()).toString());
  } catch (err) {
    console.error("Deployment error:", err.message || err);
    if (err.reason) console.error("Reason:", err.reason);
    if (err.code) console.error("Code:", err.code);
    if (err.data) console.error("Data:", JSON.stringify(err.data));
    throw err;
  }
})();
