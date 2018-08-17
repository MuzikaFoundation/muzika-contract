pragma solidity ^0.4.24;

contract TransferAndCallFallBack {
  function receiveToken(address _owner, uint256 _amount, address _token, bytes _data) public returns (bool);
}
