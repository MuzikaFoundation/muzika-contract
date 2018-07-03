pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/math/SafeMath.sol';
import '../token/MuzikaCoin.sol';
import './PreSignedContract.sol';

library LibArtistPaymentInterface {
  using SafeMath for uint256;

  struct Distribution {
    uint _fee;              // fee percent mill which represents how the distributor shares profit.
    uint _closeTime;        // distributor cannot share profit after the time over. It is represented as unix epoch.
    uint256 _maxProfit;     // max profit for distributor.
    uint256 _profit;        // current distributor's profit.
    bool _isUsed;           // whether it is used or not.
  }

  struct Artist {
    address _artist;
    address[] _papers;
    address[] _distributors;
    mapping(address => Distribution) _dists;
    MuzikaCoin _token;
  }

  // creates an artist.
  function create(
    Artist storage _artist,
    address _artistAddr,
    address[] _distributor,
    uint[] _distFees,
    uint[] _distCloseTimes,
    uint[] _maxProfits
  ) public;

  function artist(Artist storage _artist) public view returns (address);

  function distribute(Artist storage _artist) public returns (bool);

  function insertPaperContract(Artist storage _artist, address _paperContractAddress) public;

}