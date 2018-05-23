pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../lib/LibPaperPaymentInterface.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaPaperContract is Ownable {
  LibPaperPaymentInterface.Paper internal _paper;
  using LibPaperPaymentInterface for LibPaperPaymentInterface.Paper;

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

  function purchase(address _buyer) public returns (bool) {
    return _paper.purchase(_buyer);
  }

  function purchasePreSigned(uint256 _nonce, uint8 _version, bytes _sig) public returns (bool) {
    return _paper.purchasePreSigned(_nonce, _version, _sig);
  }
}
