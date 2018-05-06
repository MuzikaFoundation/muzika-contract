pragma solidity ^0.4.23;

import '../token/MuzikaCoin.sol';
import '../../zeppelin-solidity/contracts/ownership/Heritable.sol';


/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
// @TODO If change contract, disable or destroy this contract after some timeinterval
contract MuzikaPaperContract is Heritable {
  string ipfsHash;
  bool _soldOut;
  address _seller;

  mapping(address => bool) internal _purchased;

  MuzikaCoin internal _token;

  modifier onlySeller(uint paperID) {
    require(
      msg.sender == _seller,
      'Only seller can call this.'
    );
    _;
  }

  constructor(MuzikaCoin __token, string _ipfsHash, uint _heartbeatTimeout)
    Heritable(_heartbeatTimeout) public {
    ipfsHash = _ipfsHash;
    _seller = msg.sender;
    _token = __token;
    _soldOut = false;
  }

  function isPurchased(address user) public view returns (bool) {
    return _purchased[user];
  }

  function purchase(uint paperID) public returns (bool) {
    return _purchase(msg.sender, paperID);
  }

  function soldOut() public returns (bool) {
    _soldOut = true;
    return true;
  }

  function _purchase() internal returns (bool) {
    require(!_soldOut, 'This paper is not for sale');
    require(_seller != msg.sender, 'Owner cannot buy paper');
    require(!_purchased[msg.sender], 'Already bought');

    _purchased[msg.sender] = true;
    _token.transferFrom(msg.sender, paper.seller, paper.price);

    return true;
  }
}
