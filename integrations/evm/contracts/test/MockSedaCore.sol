// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SedaDataTypes} from "@seda-protocol/evm/contracts/libraries/SedaDataTypes.sol";

contract MockSedaCore {
    uint256 private _requestCounter;
    mapping(bytes32 => SedaDataTypes.Result) private _results;

    function postRequest(
        SedaDataTypes.RequestInputs calldata
    ) external payable returns (bytes32) {
        _requestCounter++;
        return bytes32(_requestCounter);
    }

    function getResult(
        bytes32 requestId
    ) external view returns (SedaDataTypes.Result memory) {
        return _results[requestId];
    }

    function setResult(
        bytes32 requestId,
        SedaDataTypes.Result calldata result
    ) external {
        _results[requestId] = result;
    }
}
