pragma solidity ^0.4.23;

import '../token/MuzikaCoin.sol';
import '../../zeppelin-solidity/contracts/ownership/Heritable.sol';


/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
// @TODO If change contract, disable or destroy this contract after some timeinterval
contract MuzikaPaperContract is Heritable {
  struct Paper {
    uint id;
    address seller;
    string title;
    uint price;
    bool forSale;
    string fileHash;
  }

  mapping(uint => Paper) public registeredPaper;
  mapping(address => mapping(uint => bool)) internal _purchased;

  uint public totalPapers;
  uint public lastPaperID;

  MuzikaCoin internal _token;

  modifier onlySeller(uint paperID) {
    require(
      msg.sender == registeredPaper[paperID].seller,
      'Only seller can call this.'
    );
    _;
  }

  constructor(MuzikaCoin __token, uint _heartbeatTimeout)
    Heritable(_heartbeatTimeout) public {
    totalPapers = 0;
    lastPaperID = 0;
    _token = __token;
  }

  function isPurchased(address user, uint paperID) public view returns (bool) {
    return _purchased[user][paperID];
  }

  function sell(string title, uint256 price, string fileHash)
    public returns (uint) {
    return _sell(msg.sender, title, price, fileHash);
  }

  function purchase(uint paperID) public returns (bool) {
    return _purchase(msg.sender, paperID);
  }

  function _sell(
    address _seller,
    string _title,
    uint256 _price,
    string _fileHash
  ) internal returns (uint) {
    require(_price > 0, 'Price must be bigger than zero');

    ++lastPaperID;
    registeredPaper[lastPaperID] = Paper(
      lastPaperID,
      _seller,
      _title,
      _price,
      true,
      _fileHash
    );
    _purchased[_seller][lastPaperID] = true;

    return lastPaperID;
  }

  function _purchase(address _buyer, uint _paperID) internal returns (bool) {
    require(
      registeredPaper[_paperID].forSale,
      'This paper is not for sale'
    );
    require(!_purchased[_buyer][_paperID], 'Already bought');

    Paper memory paper = registeredPaper[_paperID];
    _purchased[msg.sender][_paperID] = true;
    _token.transferFrom(msg.sender, paper.seller, paper.price);

    return true;
  }
}
