pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/math/SafeMath.sol';
import '../token/MuzikaCoin.sol';
import './PreSignedContract.sol';
import './LibPaperPaymentInterface.sol';

library LibPaperPayment {
  using SafeMath for uint256;

  function create(
    LibPaperPaymentInterface.Paper storage paper,
    address _seller,
    uint256 _price,
    string _ipfsFileHash,
    string _originalFileHash
  ) public {
    paper._seller = _seller;
    paper._price = _price;
    paper._forSale = true;
    paper._originalFileHash = _originalFileHash;
    paper._ipfsFileHash = _ipfsFileHash;
    paper._token = MuzikaCoin(0x9999888877776666555544443333222211110000);
    paper._preSignedContract = PreSignedContract(0x1111222233334444555566667777888899990000);
  }

  function seller(LibPaperPaymentInterface.Paper storage paper) public view returns (address) {
    return paper._seller;
  }

  function price(LibPaperPaymentInterface.Paper storage paper) public view returns (uint256) {
    return paper._price;
  }

  function forSale(LibPaperPaymentInterface.Paper storage paper) public view returns (bool) {
    return paper._forSale;
  }

  function originalFileHash(LibPaperPaymentInterface.Paper storage paper) public view returns (string) {
    return paper._originalFileHash;
  }

  function ipfsFileHash(LibPaperPaymentInterface.Paper storage paper) public view returns (string) {
    require(msg.sender == paper._seller || paper._purchased[msg.sender]);

    return paper._ipfsFileHash;
  }

  function isPurchased(LibPaperPaymentInterface.Paper storage paper, address user) public view returns (bool) {
    return paper._purchased[user];
  }

  function soldOut(LibPaperPaymentInterface.Paper storage paper) public {
    require(msg.sender == paper._seller);
    paper._forSale = false;
  }

  function purchase(LibPaperPaymentInterface.Paper storage paper, address _buyer) public returns (bool) {
    require(paper._forSale);
    require(msg.sender == address(paper._token));
    require(!paper._purchased[_buyer]);

    paper._purchased[_buyer] = true;

    if (paper._price > 0) {
      uint256 _fee = paper._price.div(100).mul(5); // 5% fee

      paper._token.transferFrom(_buyer, paper._seller, paper._price.sub(_fee));
      paper._token.transferFrom(_buyer, msg.sender, _fee); // payback to sender
    }

    return true;
  }
}
