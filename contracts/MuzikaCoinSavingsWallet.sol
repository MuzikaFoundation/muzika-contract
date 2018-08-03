pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Heritable.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaCoinSavingsWallet is Heritable {

  event Sent(address indexed payee, uint256 amount, uint256 balance);
  event Received(address indexed payer, uint256 amount, uint256 balance);


  constructor(uint256 _heartbeatTimeout) Heritable(_heartbeatTimeout) public {}

  /**
   * @dev wallet can receive funds.
   */
  function() public payable {
    emit Received(msg.sender, msg.value, address(this).balance);
  }

  /**
   * @dev wallet can send funds
   */
  function sendTo(address payee, uint256 amount) public onlyOwner {
    require(payee != 0 && payee != address(this), 'Cannot send to yourself');
    require(amount > 0, 'Amount must be greater than zero');
    payee.transfer(amount);
    emit Sent(payee, amount, address(this).balance);
  }
}
