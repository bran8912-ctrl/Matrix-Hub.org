// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidityDeposit {
    function depositLiquidity(uint256 amount) external;
}

contract MockCasinoCore {
    function depositLiquidity(address token, address router, uint256 amount) external {
        require(IERC20(token).transfer(router, amount), "TRANSFER_FAILED");
        ILiquidityDeposit(router).depositLiquidity(amount);
    }
}
