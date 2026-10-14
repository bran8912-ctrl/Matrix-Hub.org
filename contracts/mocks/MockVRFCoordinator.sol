// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface IVRFConsumerMock {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

contract MockVRFCoordinator {
    uint256 public nextRequestId = 1;
    mapping(uint256 => address) public consumers;
    mapping(uint256 => VRFV2PlusClient.RandomWordsRequest) private _requests;

    event RequestReceived(
        uint256 indexed requestId,
        address indexed consumer,
        uint256 subscriptionId,
        bytes32 keyHash,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs
    );

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata request)
        external
        returns (uint256 requestId)
    {
        requestId = nextRequestId++;
        consumers[requestId] = msg.sender;
        _requests[requestId] = request;
        emit RequestReceived(
            requestId,
            msg.sender,
            request.subId,
            request.keyHash,
            request.requestConfirmations,
            request.callbackGasLimit,
            request.numWords,
            request.extraArgs
        );
    }

    function getRequest(uint256 requestId)
        external
        view
        returns (VRFV2PlusClient.RandomWordsRequest memory)
    {
        return _requests[requestId];
    }

    function fulfill(uint256 requestId, uint256 randomWord) external {
        address consumer = consumers[requestId];
        require(consumer != address(0), "unknown request");
        delete consumers[requestId];

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = randomWord;
        IVRFConsumerMock(consumer).rawFulfillRandomWords(requestId, randomWords);
    }
}
