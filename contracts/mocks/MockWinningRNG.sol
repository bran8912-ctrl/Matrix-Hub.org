// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockWinningRNG
 * @author Matrix-Hub Team
 * @notice Test double that always resolves a casino bet as a win.
 */
contract MockWinningRNG {
    /// @notice Test outcome returned for each bet.
    bool public outcome = true;

    /// @notice Hash of the most recently resolved game data.
    bytes32 public lastGameDataHash;

    /// @notice Set the fixed test outcome.
    /// @param _outcome Whether the next resolved bet should win.
    function setOutcome(bool _outcome) external {
        outcome = _outcome;
    }

    /// @notice Record game data and return the configured test outcome.
    /// @param gameData Encoded game data to record.
    /// @return Whether the bet wins.
    function resolve(bytes calldata gameData) external returns (bool) {
        lastGameDataHash = keccak256(gameData);
        return outcome;
    }
}
