pragma solidity ^0.4.23;

import '../token/MuzikaCoin.sol';
import '../../zeppelin-solidity/contracts/ownership/Heritable.sol';


/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaPaperContract is Heritable {
  string originalFileHash;
  bool _forSale;
  address _seller;
  uint256 _price;

  mapping(address => bool) internal _purchased;

  MuzikaCoin internal _token;

  modifier onlySeller() {
    require(
      msg.sender == _seller,
      'Only seller can call this.'
    );
    _;
  }

  constructor(
    MuzikaCoin __token,
    string _ipfsHash,
    uint256 price,
    uint _heartbeatTimeout
  )
    Heritable(_heartbeatTimeout) public {
    originalFileHash = _ipfsHash;
    _seller = msg.sender;
    _token = __token;
    _price = price;
    _forSale = true;
  }

  function isPurchased(address user) public view returns (bool) {
    return _purchased[user];
  }

  function soldOut()
    public
    onlySeller
  {
    _forSale = false;
  }

  function purchase() public returns (bool) {
    require(_forSale, 'This paper is not for sale');
    require(_seller != msg.sender, 'Owner cannot buy paper');
    require(!_purchased[msg.sender], 'Already bought');

    _purchased[msg.sender] = true;
    _token.transferFrom(msg.sender, _seller, _price);

    return true;
  }
}
