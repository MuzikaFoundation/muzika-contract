pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/math/SafeMath.sol';
import '../token/MuzikaCoin.sol';
import './PreSignedContract.sol';

library LibPaperPaymentInterface {
  using SafeMath for uint256;

  struct Paper {
    address _seller;
    uint256 _price;
    bool _forSale;
    string _originalFileHash;
    string _ipfsFileHash;
    mapping(address => bool) _purchased;
    MuzikaCoin _token;
    PreSignedContract _preSignedContract;
  }

  function create(
    Paper storage paper,
    address _seller,
    uint256 _price,
    string _ipfsFileHash,
    string _originalFileHash
  ) public;

  function seller(Paper storage paper) public view returns (address);

  function price(Paper storage paper) public view returns (uint256);

  function forSale(Paper storage paper) public view returns (bool);

  function originalFileHash(Paper storage paper) public view returns (string);

  function ipfsFileHash(Paper storage paper) public view returns (string);

  function isPurchased(Paper storage paper, address user) public view returns (bool);

  function soldOut(Paper storage paper) public;

  function purchase(Paper storage paper, address _buyer) public returns (bool);

  function purchasePreSigned(
    Paper storage paper,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) public returns (bool);
}
