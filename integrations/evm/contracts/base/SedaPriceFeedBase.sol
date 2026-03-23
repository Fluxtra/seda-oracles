// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ISedaCore} from "@seda-protocol/evm/contracts/interfaces/ISedaCore.sol";
import {SedaDataTypes} from "@seda-protocol/evm/contracts/libraries/SedaDataTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

abstract contract SedaPriceFeedBase is Ownable {
    ISedaCore public immutable sedaCore;
    bytes32 public oracleProgramId;
    bytes32 public latestRequestId;
    uint128 public latestPrice;
    uint64 public latestTimestamp;
    uint256 public stalenessThreshold;
    bool public resultFetched;

    event RequestTransmitted(bytes32 indexed requestId);
    event ResultFetched(bytes32 indexed requestId, uint128 price, uint64 timestamp);
    event RequestCancelled(bytes32 indexed requestId);
    event OracleProgramIdUpdated(bytes32 oldId, bytes32 newId);
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    error RequestNotTransmitted();
    error RequestPending();
    error ResultNotReady();
    error NoConsensus();
    error ExecutionFailed(uint8 exitCode);
    error InvalidResultLength(uint256 length);
    error StalePrice(uint64 resultTimestamp, uint256 threshold);
    error NotInitialized();
    error InvalidAddress();
    error InvalidProgramId();

    constructor(
        address _sedaCore,
        bytes32 _oracleProgramId,
        uint256 _stalenessThreshold
    ) Ownable(msg.sender) {
        if (_sedaCore == address(0)) revert InvalidAddress();
        if (_oracleProgramId == bytes32(0)) revert InvalidProgramId();
        sedaCore = ISedaCore(_sedaCore);
        oracleProgramId = _oracleProgramId;
        stalenessThreshold = _stalenessThreshold;
    }

    /// @notice Post a new data request to SEDA Core.
    /// @dev Reverts if a previous request is pending (not yet fetched).
    function transmit() external payable onlyOwner returns (bytes32) {
        if (latestRequestId != bytes32(0) && !resultFetched) {
            revert RequestPending();
        }

        SedaDataTypes.RequestInputs memory inputs = SedaDataTypes.RequestInputs(
            oracleProgramId,
            oracleProgramId,
            1,                    // gasPrice
            300000000000,         // execGasLimit
            100000000000,         // tallyGasLimit
            3,                    // replicationFactor
            _execInputs(),        // execInputs
            hex"00",              // tallyInputs
            hex"00",              // consensusFilter = None
            abi.encodePacked(block.number)
        );

        // State updates after external call to avoid locking on revert.
        // postRequest is a trusted call to the immutable sedaCore contract.
        bytes32 requestId = sedaCore.postRequest{value: msg.value}(inputs);
        resultFetched = false;
        latestRequestId = requestId;
        emit RequestTransmitted(requestId);
        return requestId;
    }

    /// @notice Fetch the latest result from SEDA Core and update stored price.
    /// @dev Intentionally permissionless — anyone can relay results from SEDA Core.
    ///      The result integrity is guaranteed by SEDA's consensus mechanism.
    function fetchResult() external {
        if (latestRequestId == bytes32(0)) revert RequestNotTransmitted();

        SedaDataTypes.Result memory result = sedaCore.getResult(latestRequestId);

        if (result.blockTimestamp == 0) revert ResultNotReady();
        if (!result.consensus) revert NoConsensus();
        if (result.exitCode != 0) revert ExecutionFailed(result.exitCode);
        if (result.result.length < 16) revert InvalidResultLength(result.result.length);

        // Decode big-endian u128 from tally result (first 16 bytes)
        latestPrice = uint128(bytes16(result.result));
        latestTimestamp = result.blockTimestamp;
        resultFetched = true;

        emit ResultFetched(latestRequestId, latestPrice, latestTimestamp);
    }

    /// @notice Get the latest price. Reverts if no result has been fetched yet.
    function latestAnswer() external view returns (uint128) {
        if (latestTimestamp == 0) revert NotInitialized();
        return latestPrice;
    }

    /// @notice Get the latest price with staleness check.
    /// @dev Uses Solidity 0.8 checked arithmetic — reverts on underflow if
    ///      latestTimestamp somehow exceeds block.timestamp (should not happen
    ///      in normal operation since SEDA timestamps track real time).
    function latestAnswerSafe() external view returns (uint128) {
        if (latestTimestamp == 0) revert NotInitialized();
        if (
            stalenessThreshold > 0 &&
            block.timestamp - latestTimestamp > stalenessThreshold
        ) {
            revert StalePrice(latestTimestamp, stalenessThreshold);
        }
        return latestPrice;
    }

    /// @notice Cancel a pending request that will never resolve (owner escape hatch).
    /// @dev Clears the pending state so transmit() can be called again. Does not
    ///      affect latestPrice/latestTimestamp (previous valid result is preserved).
    function cancelPendingRequest() external onlyOwner {
        if (latestRequestId == bytes32(0) || resultFetched) {
            revert RequestNotTransmitted();
        }
        emit RequestCancelled(latestRequestId);
        resultFetched = true;
    }

    /// @notice Update the oracle program ID (owner only).
    function setOracleProgramId(bytes32 _newId) external onlyOwner {
        if (_newId == bytes32(0)) revert InvalidProgramId();
        bytes32 oldId = oracleProgramId;
        oracleProgramId = _newId;
        emit OracleProgramIdUpdated(oldId, _newId);
    }

    /// @notice Update the staleness threshold (owner only).
    /// @dev Set to 0 to disable staleness checking. No upper bound is enforced;
    ///      the owner is trusted to set a reasonable value.
    function setStalenessThreshold(uint256 _newThreshold) external onlyOwner {
        uint256 old = stalenessThreshold;
        stalenessThreshold = _newThreshold;
        emit StalenessThresholdUpdated(old, _newThreshold);
    }

    /// @notice Returns the exec inputs bytes for the data request.
    function _execInputs() internal pure virtual returns (bytes memory);

    /// @notice Returns a human-readable description of this price feed.
    function description() external pure virtual returns (string memory);

    /// @notice Returns the number of decimals (18).
    function decimals() external pure returns (uint8) {
        return 18;
    }
}
