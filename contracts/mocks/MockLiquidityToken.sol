// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockLiquidityToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}
