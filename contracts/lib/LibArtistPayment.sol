pragma solidity ^0.4.24;

import "./LibArtistPaymentInterface.sol";
import '../payment/MuzikaPaperContract.sol';

library LibArtistPayment {
  using SafeMath for uint256;

  // creates an artist.
  function create(
    LibArtistPaymentInterface.Artist storage _artist,
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

      _artist._dists[_distributor[i]] =
      LibArtistPaymentInterface.Distribution(_distFees[i], _distCloseTimes[i], _maxProfits[i], 0, true);
    }

    // the sum of distribution fees cannot over 100%
    require(distFeeSum <= 1000);

    _artist._token = MuzikaCoin(0x9999888877776666555544443333222211110000);
  }

  function artist(LibArtistPaymentInterface.Artist storage _artist) public view returns (address) {
    return _artist._artist;
  }

  function distribute(LibArtistPaymentInterface.Artist storage _artist) public returns (bool) {
    require(msg.sender == _artist._artist);

    // get current balance
    uint256 balance = _artist._token.balanceOf(address(this));
    uint256 remain = balance;

    for (uint i = 0; i < _artist._distributors.length; i++) {
      address distAddress = _artist._distributors[i];
      LibArtistPaymentInterface.Distribution memory dist = _artist._dists[distAddress];

      uint256 distAmount = balance.mul(dist._fee).div(1000);

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
      _artist._token.transfer(distAddress, distAmount);
      remain = remain.sub(distAmount);
    }

    // send remain to the artist
    if (remain > 0) {
      _artist._token.transfer(_artist._artist, remain);
    }

    return true;
  }

  function insertPaperContract(
    LibArtistPaymentInterface.Artist storage _artist,
    address _paperContractAddress
  ) public {
    _artist._papers.push(_paperContractAddress);
  }
}