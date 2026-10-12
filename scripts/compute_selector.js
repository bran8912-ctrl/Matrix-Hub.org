const ethers = require("ethers");
const selector = ethers.id("setClientSeed(bytes32)").slice(0, 10);
console.log("Function selector:", selector);

const arg = "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
const paddedArg = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [arg]);
const calldata = selector + paddedArg.slice(10);
console.log("Full calldata:", calldata);
