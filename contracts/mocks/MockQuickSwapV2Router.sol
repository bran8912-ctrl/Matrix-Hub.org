// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockQuickSwapV2Router {
    address public immutable WETH;
    uint256 public nativeAmountToUse;
    uint256 public tokenAmountToUse;

    constructor(address wrappedNative) {
        WETH = wrappedNative;
    }

    function setNativeAmountToUse(uint256 amount) external {
        nativeAmountToUse = amount;
    }

    function setTokenAmountToUse(uint256 amount) external {
        tokenAmountToUse = amount;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        amountToken = tokenAmountToUse == 0 ? amountTokenDesired : tokenAmountToUse;
        amountETH = nativeAmountToUse == 0 ? msg.value : nativeAmountToUse;
        require(amountToken >= amountTokenMin, "INSUFFICIENT_TOKEN_AMOUNT");
        require(amountETH >= amountETHMin && amountETH <= msg.value, "INSUFFICIENT_NATIVE_AMOUNT");

        require(IERC20(token).transferFrom(msg.sender, address(this), amountToken), "TRANSFER_FAILED");
        liquidity = amountToken < amountETH ? amountToken : amountETH;

        uint256 refund = msg.value - amountETH;
        if (refund > 0) {
            (bool refunded,) = payable(msg.sender).call{value: refund}("");
            require(refunded, "REFUND_FAILED");
        }
    }
}
