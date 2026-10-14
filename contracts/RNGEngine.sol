// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface ICasinoCoreRandomness {
    function fulfillRandomness(uint256 requestId, uint256 randomWord) external;
}

contract RNGEngine is VRFConsumerBaseV2Plus {
    error NotCasinoCore();
    error InvalidVrfConfiguration();

    event CasinoCoreUpdated(address indexed casinoCore);
    event RandomnessRequested(uint256 indexed requestId);

    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public immutable callbackGasLimit;
    uint16 public immutable requestConfirmations;
    address public casinoCore;

    constructor(
        address vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        if (
            _subscriptionId == 0 ||
            _keyHash == bytes32(0) ||
            _callbackGasLimit == 0 ||
            _requestConfirmations == 0
        ) revert InvalidVrfConfiguration();

        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
    }

    modifier onlyCasinoCore() {
        if (msg.sender != casinoCore) revert NotCasinoCore();
        _;
    }

    function setCasinoCore(address _casinoCore) external onlyOwner {
        if (_casinoCore == address(0)) revert ZeroAddress();
        casinoCore = _casinoCore;
        emit CasinoCoreUpdated(_casinoCore);
    }

    function requestRandomWords() external onlyCasinoCore returns (uint256 requestId) {
        VRFV2PlusClient.RandomWordsRequest memory request = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
            )
        });

        requestId = s_vrfCoordinator.requestRandomWords(request);
        emit RandomnessRequested(requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        ICasinoCoreRandomness(casinoCore).fulfillRandomness(requestId, randomWords[0]);
    }
}
