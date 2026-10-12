// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AddressScanner {
    function computeCreateAddress(address sender, uint256 nonce) public pure returns (address) {
        bytes memory encoded;
        if (nonce == 0) {
            encoded = abi.encodePacked(bytes1(0xd6), bytes1(0x94), sender, bytes1(0x80));
        } else if (nonce < 0x80) {
            encoded = abi.encodePacked(bytes1(0xd6), bytes1(0x94), sender, bytes1(uint8(nonce)));
        } else if (nonce < 0x100) {
            encoded = abi.encodePacked(bytes1(0xd7), bytes1(0x94), sender, bytes1(0x81), bytes1(uint8(nonce)));
        } else if (nonce < 0x10000) {
            encoded = abi.encodePacked(bytes1(0xd8), bytes1(0x94), sender, bytes1(0x82), bytes2(uint16(nonce)));
        } else if (nonce < 0x1000000) {
            encoded = abi.encodePacked(bytes1(0xd9), bytes1(0x94), sender, bytes1(0x83), bytes3(uint24(nonce)));
        } else if (nonce < 0x100000000) {
            encoded = abi.encodePacked(bytes1(0xda), bytes1(0x94), sender, bytes1(0x84), bytes4(uint32(nonce)));
        } else {
            revert("Nonce too large");
        }
        bytes32 hash = keccak256(encoded);
        return address(uint160(uint256(hash)));
    }

    function hasCode(address addr) public view returns (bool, uint256) {
        uint256 size;
        assembly { size := extcodesize(addr) }
        return (size > 0, size);
    }

    function scanAddresses(address deployer, uint256 count) public view returns (
        address[] memory addresses,
        bool[] memory hasCodes,
        uint256[] memory codeSizes
    ) {
        addresses = new address[](count);
        hasCodes = new bool[](count);
        codeSizes = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            addresses[i] = computeCreateAddress(deployer, i);
            (bool has, uint256 size) = hasCode(addresses[i]);
            hasCodes[i] = has;
            codeSizes[i] = size;
        }
    }
}
