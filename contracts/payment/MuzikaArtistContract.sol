pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../lib/ApprovalAndCallFallBack.sol';
import './MuzikaPaperContract.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaArtistContract is Ownable {
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

  Artist internal _artist;

//  event Purchase(address indexed buyer, uint price);
//  event SoldOut(uint at);
//  event Resale(uint at);

  constructor(
    address _artistAddr,
    address[] _distributor,
    uint[] _distFees,
    uint[] _distCloseTimes,
    uint256[] _maxProfits
  ) public {
    // all distribution info arrays should have the equal length.
    require(_distributor.length == _distFees.length);
    require(_distributor.length == _distCloseTimes.length);
    require(_distributor.length == _maxProfits.length);

    _artist._artist = _artistAddr;

    uint distFeeSum = 0;
    for (uint i = 0; i < _distributor.length; i++) {
      _artist._distributors.push(_distributor[i]);

      // check if the address is artist. No distributors are artist oneself.
      require(_distributor[i] != _artistAddr);

      // check if the fee is 0%.
      require(_distFees[i] != 0);

      // check if addresses are duplicated in the distributor address
      require(_artist._dists[_distributor[i]]._isUsed != true);

      distFeeSum += _distFees[i];

      _artist._dists[_distributor[i]] = Distribution(_distFees[i], _distCloseTimes[i], _maxProfits[i], 0, true);
    }

    // the sum of distribution fees cannot over 100.00%
    require(distFeeSum <= 10000);

    _artist._token = MuzikaCoin(0x9999888877776666555544443333222211110000);
  }

  function artist() public view returns (address) {
    return _artist._artist;
  }

  function distribute() public returns (bool) {
    require(msg.sender == _artist._artist);

    // get current balance
    uint256 balance = _artist._token.balanceOf(address(this));
    uint256 remain = balance;

    for (uint i = 0; i < _artist._distributors.length; i++) {
      address distAddress = _artist._distributors[i];
      Distribution memory dist = _artist._dists[distAddress];

      uint256 distAmount = balance.mul(dist._fee).div(10000);

      // check if being over max profit
      if (dist._maxProfit != 0) {
        if (dist._maxProfit < dist._profit.add(distAmount)) {
          distAmount = dist._maxProfit.sub(dist._profit);
        }

        _artist._dists[distAddress]._profit = dist._profit.add(distAmount);
      }

      // if max proper or time over, don't distribute him/her.
      if (distAmount == 0 || (dist._closeTime != 0 && dist._closeTime < now)) continue;

      // send token
      require(remain >= distAmount);
      remain = remain.sub(distAmount);
      _artist._token.transfer(distAddress, distAmount);
    }

    // send remain to the artist
    if (remain > 0) {
      _artist._token.transfer(_artist._artist, remain);
    }

    return true;
  }

  function createPaper(
    uint256 _price,
    string _ipfsFileHash,
    string _originalFileHash
  ) public {
    _artist._papers.push(new MuzikaPaperContract(address(this), _price, _ipfsFileHash, _originalFileHash));
  }

  function papers() public view returns (address[]) {
    return _artist._papers;
  }
}