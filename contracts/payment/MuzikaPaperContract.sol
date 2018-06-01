pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../lib/LibPaperPaymentInterface.sol';
import '../lib/ApprovalAndCallFallBack.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaPaperContract is Ownable, ApprovalAndCallFallBack {
  LibPaperPaymentInterface.Paper internal _paper;
  using LibPaperPaymentInterface for LibPaperPaymentInterface.Paper;

  event Purchase(address indexed buyer, uint price);
  event SoldOut(uint at);
  event Resale(uint at);

  constructor(
    address _seller,
    uint256 _price,
    string _ipfsFileHash,
    string _originalFileHash
  ) public {
    _paper.create(_seller, _price, _ipfsFileHash, _originalFileHash);
  }

  function seller() public view returns (address) {
    return _paper.seller();
  }

  function price() public view returns (uint256) {
    return _paper.price();
  }

  function forSale() public view returns (bool) {
    return _paper.forSale();
  }

  function originalFileHash() public view returns (string) {
    return _paper.originalFileHash();
  }

  function ipfsFileHash() public view returns (string) {
    return _paper.ipfsFileHash();
  }

  function isPurchased(address user) public view returns (bool) {
    return _paper.isPurchased(user);
  }

  function soldOut() public {
    return _paper.soldOut();
  }

  function resale() public {
    return _paper.resale();
  }

  function purchase(address _buyer) public returns (bool) {
    return _paper.purchase(_buyer);
  }

  function receiveApproval(
    address _owner,
    uint256 /* _amount */,
    address /* _token */,
    bytes /* _data */
  )
    public returns (bool)
  {
    return _paper.purchase(_owner);
  }
}
