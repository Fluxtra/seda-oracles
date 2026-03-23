// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SedaPriceFeedBase} from "./base/SedaPriceFeedBase.sol";

contract MantraUsdPriceFeed is SedaPriceFeedBase {
    constructor(
        address _sedaCore,
        bytes32 _oracleProgramId,
        uint256 _stalenessThreshold
    ) SedaPriceFeedBase(_sedaCore, _oracleProgramId, _stalenessThreshold) {}

    function _execInputs() internal pure override returns (bytes memory) {
        return bytes("MANTRA-USD");
    }

    function description() external pure override returns (string memory) {
        return "MANTRA / USD";
    }
}
