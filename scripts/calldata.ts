import { id, AbiCoder } from "ethers";

const selector = id("setClientSeed(bytes32)").slice(0, 10);
console.log("Function selector:", selector);

const arg = "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
const encoded = AbiCoder.defaultAbiCoder().encode(["bytes32"], [arg]);
const calldata = selector + encoded.slice(10);
console.log("Full calldata:", calldata);
