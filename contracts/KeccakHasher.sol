// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KeccakHasher
/// @notice A minimal contract that computes the keccak256 hash of arbitrary calldata.
contract KeccakHasher {
    /// @notice Returns the keccak256 hash of the calldata (msg.data minus the selector).
    /// @dev The fallback function receives all raw calldata after the first 4 bytes
    ///      (function selector) — in Remix calling without ABI this passes the full
    ///      calldata. We provide an explicit function to keep it simple and testable.
    function hash(bytes memory data) external pure returns (bytes32) {
        return keccak256(data);
    }

    /// @notice Returns the keccak256 hash of the entire calldata passed to this call.
    function hashCalldata() external pure returns (bytes32) {
        return keccak256(msg.data);
    }
}
