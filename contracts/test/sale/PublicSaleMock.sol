pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../../sale/PublicSale.sol';

contract PublicSaleMock is PublicSale {

  constructor(
    ERC20 _token,
    address _wallet,
    uint256 _rate,
    uint256 _minCapPerPerson,
    uint256 _maxCapPerPerson,
    uint256 _maxCap,
    uint256 _saleStartTime,
    uint256 _saleEndTime,
    uint256 _initialReleaseRatio,
    uint256 _releaseRatioPerStep,
    uint256 _totalSteps,
    uint256 _daysInterval
  )
    public
    PublicSale(
      _token,
      _wallet,
      _rate,
      _minCapPerPerson,
      _maxCapPerPerson,
      _maxCap,
      _saleStartTime,
      _saleEndTime,
      _initialReleaseRatio,
      _releaseRatioPerStep,
      _totalSteps,
      _daysInterval
    )
  { }

  modifier canClaimFor(address _beneficiary) {
    // For test, remove `days` unit
    require(now >= saleEndTime + currentSteps[_beneficiary] * daysInterval);
    _;
  }
}
