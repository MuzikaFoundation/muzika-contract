pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../../sale/PrivateSale.sol';

contract PrivateSaleMock is PrivateSale {
  constructor(
    ERC20 _token,
    uint256 _rate,
    uint256 _initialReleaseRatio,
    uint256 _releaseRatioPerStep,
    uint256 _totalSteps,
    uint256 _daysInterval
  )
    public
    PrivateSale(
      _token,
      _rate,
      _initialReleaseRatio,
      _releaseRatioPerStep,
      _totalSteps,
      _daysInterval
    )
  { }

  modifier canClaimFor(address _beneficiary) {
    // For test, remove `days` unit
    require(now >= releasedTime + currentSteps[_beneficiary] * daysInterval);
    _;
  }
}
