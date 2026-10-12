// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RNGEngine
 * @author Matrix-Hub Team
 * @notice Provably fair random number generator for casino games on Polygon
 * @dev Uses server seed commitment and client seed for verifiable randomness
 */
contract RNGEngine {
    // Custom errors for gas efficiency
    error NotAuthorized();
    error ClientSeedNotSet();

    /// @notice Server seed hash for commitment
    bytes32 public serverSeedHash;
    
    /// @notice Client seed for randomness
    bytes32 public clientSeed;
    
    /// @notice Nonce for unique random values
    uint256 public nonce;

    /// @notice Casino core contract authorized to call resolve
    address public casinoCore;

    /// @notice Owner address for administrative functions
    address public owner;

    /**
     * @notice Constructor initializes RNG with casino core address
     * @param _casinoCore Address of CasinoCore contract
     */
    constructor(address _casinoCore) {
        casinoCore = _casinoCore;
        owner = msg.sender;
    }

    /**
     * @notice Modifier to restrict access to owner only
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    /**
     * @notice Modifier to restrict access to CasinoCore only
     */
    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotAuthorized();
        _;
    }

    /**
     * @notice Set client seed for randomness
     * @dev Should be called by player to ensure provable fairness
     * @param _clientSeed Client-provided seed
     */
    function setClientSeed(bytes32 _clientSeed) external {
        clientSeed = _clientSeed;
    }

    /**
     * @notice Commit server seed hash
     * @dev Only owner can commit to prevent manipulation
     * @param hash Hash of server seed
     */
    function commitServerSeed(bytes32 hash) external onlyOwner {
        serverSeedHash = hash;
    }

    /**
     * @notice Resolve game outcome
     * @dev Only callable by CasinoCore, generates random result and increments nonce
     * @param gameData Encoded game data
     * @return True if player wins, false otherwise
     */
    function resolve(bytes calldata gameData) external onlyCasinoCore returns (bool) {
        if (clientSeed == bytes32(0)) revert ClientSeedNotSet();
        bytes32 result = keccak256(abi.encodePacked(serverSeedHash, clientSeed, nonce, gameData));
        ++nonce;
        return interpretResult(result);
    }

    /**
     * @notice Update the CasinoCore address (owner only)
     * @dev Used to resolve circular deployment dependency
     * @param _casinoCore New CasinoCore contract address
     */
    function setCasinoCore(address _casinoCore) external onlyOwner {
        if (_casinoCore == address(0)) revert NotAuthorized();
        casinoCore = _casinoCore;
    }

    /**
     * @notice Reveal server seed to verify fairness
     * @dev Allows verification that server didn't cheat
     * @param seed Original server seed
     * @return True if seed matches committed hash
     */
    function revealServerSeed(bytes32 seed) external view returns (bool) {
        return keccak256(abi.encodePacked(seed)) == serverSeedHash;
    }

    /**
     * @notice Interpret random result
     * @dev Internal function to determine win/loss from random bytes
     * @param result Random bytes32 value
     * @return True if player wins, false otherwise
     */
    function interpretResult(bytes32 result) internal pure returns (bool) {
        // Example: 50/50 win/lose
        return uint256(result) % 2 == 0;
    }
}
