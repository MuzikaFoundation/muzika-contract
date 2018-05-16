pragma solidity ^0.4.23;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../../zeppelin-solidity/contracts/math/SafeMath.sol';
import '../token/MuzikaCoin.sol';
import '../lib/PreSignedContract.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaPaperContract is Ownable {
  using SafeMath for uint256;

  string _ipfsFileHash;
  string _originalFileHash;
  uint256 _price;
  bool _forSale;
  address _seller;

  mapping(address => bool) internal _purchased;

  MuzikaCoin internal _token = MuzikaCoin(0x9999888877776666555544443333222211110000);
  PreSignedContract internal _preSignedContract = PreSignedContract(0x1111222233334444555566667777888899990000);

  modifier onlySeller() {
    require(msg.sender == _seller);
    _;
  }

  modifier bought() {
    require(_purchased[msg.sender]);
    _;
  }

  constructor(
    address seller,
    uint256 price,
    string ipfsFileHash,
    string originalFileHash
  ) public {
    _seller = seller;
    _price = price;
    _ipfsFileHash = ipfsFileHash;
    _originalFileHash = originalFileHash;
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

  function originalFileHash() public view returns (string) {
    return _originalFileHash;
  }

  function ipfsFileHash() public bought view returns (string) {
    return _ipfsFileHash;
  }

  function purchase(uint256 _nonce, uint8 _version, bytes _sig) public returns (bool) {
    require(_forSale);
    require(_seller != msg.sender);
    require(!_purchased[msg.sender]);

    address _buyer = _preSignedContract.increaseApprovalPreSignedCheck(
      _token,
      address(this),
      _price,
      0,
      _nonce,
      _version,
      _sig
    );

    _purchased[_buyer] = true;

    if (_price > 0) {
      uint256 _fee = _price.div(100).mul(5); // 5% fee

      _token.increaseApprovalPreSigned(address(this), _price, 0, _nonce, _version, _sig);
      _token.transferFrom(_buyer, _seller, _price.sub(_fee));
      _token.transferFrom(_buyer, msg.sender, _fee); // payback to sender
    }

    return true;
  }
}
