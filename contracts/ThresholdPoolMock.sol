pragma solidity ^0.4.8;

import "./ThresholdPool.sol";

contract ThresholdPoolMock is ThresholdPool () {

  uint256 public _now;

  function ThresholdPoolMock (
    uint256 _poolTime,
    uint256 _threshold,
    address _recipient,
    uint256 _currentTime
  ) ThresholdPool (_poolTime, _threshold, _recipient) payable {
    _now = _currentTime;
    startTime = _now;
  }

  function currentTime() returns (uint256 _currentTime) {
    return _now;
  }

  function changeTime(uint256 _newTime) {
    _now = _newTime;
  }

}
