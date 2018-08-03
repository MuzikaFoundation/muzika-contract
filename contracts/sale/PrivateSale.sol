pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract PrivateSale is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public balances;         // remaining amount for releasing to each user in wei
  mapping (address => uint256) public raisedBy;         // raised amount by each user in wei
  mapping (address => uint256) public currentSteps;     // for releasing step per user
  address[] public investors;

  ERC20 public token;
  uint256 public rate;
  uint256 public weiRaised;

  uint256 public releasedTime;              // the time when time-lockup is released and token can be distributed per step
  uint256 public initialReleaseRatio;       // just after released, how amount of token will be distributed
  uint256 public releaseRatioPerStep;       // how many token will be released per step
  uint256 public totalSteps;
  uint256 public daysInterval;

  event Raise(address indexed investor, uint256 amount);
  event Claim(
    address indexed claimer,
    address indexed beneficiary,
    uint256 step,
    uint256 amount
  );
  event Release(
    uint256 at
  );

  modifier whenNotLocked() {
    require(releasedTime != 0 && now >= releasedTime);
    _;
  }

  modifier canClaimFor(address _beneficiary) {
    require(now >= releasedTime + currentSteps[_beneficiary] * daysInterval * 1 days);
    _;
  }

  constructor(
    ERC20 _token,
    uint256 _rate,
    uint256 _initialReleaseRatio,
    uint256 _releaseRatioPerStep,
    uint256 _totalSteps,
    uint256 _daysInterval
  ) public {
    require(_initialReleaseRatio <= 100);
    require(_releaseRatioPerStep <= 100);

    token = _token;
    rate = _rate;
    initialReleaseRatio = _initialReleaseRatio;
    releaseRatioPerStep = _releaseRatioPerStep;
    totalSteps = _totalSteps;
    daysInterval = _daysInterval;
  }

  function investorCount() external view returns(uint256) {
    return investors.length;
  }

  function releaseTimeLockup(uint256 _releasedTime) external onlyOwner {
    releasedTime = _releasedTime;
    emit Release(_releasedTime);
  }

  function calcReleasableAmountInWei(uint256 _step, address _beneficiary) public view returns (uint256) {
    if (_step == totalSteps) {
      return balances[_beneficiary];
    }

    uint256 ratio = _step == 0 ? initialReleaseRatio : releaseRatioPerStep;
    uint256 amount = raisedBy[_beneficiary].mul(ratio).div(100);

    return amount > balances[_beneficiary] ? balances[_beneficiary] : amount;
  }

  function calcTokenAmount(uint256 _weiAmount) public view returns (uint256) {
    return _weiAmount.mul(rate);
  }

  function setInvestor(address _investor, uint256 _value) external onlyOwner {
    require(_value > 0);
    require(raisedBy[_investor] == 0);

    balances[_investor] = _value;
    raisedBy[_investor] = _value;
    investors.push(_investor);
    weiRaised = weiRaised.add(_value);

    emit Raise(_investor, _value);
  }

  function claim() external {
    claimFor(msg.sender);
  }

  function claimFor(address _beneficiary) public whenNotLocked canClaimFor(_beneficiary) {
    require(balances[_beneficiary] > 0);

    uint256 currentStep = currentSteps[_beneficiary];
    uint256 weiAmount = calcReleasableAmountInWei(currentStep, _beneficiary);
    uint256 amount = calcTokenAmount(weiAmount);

    balances[_beneficiary] = balances[_beneficiary].sub(weiAmount);
    currentSteps[_beneficiary]++;

    token.transfer(_beneficiary, amount);

    emit Claim(msg.sender, _beneficiary, currentStep, amount);
  }

  function distribute() external onlyOwner {
    for(uint32 i = 0; i < investors.length; i++) {
      claimFor(investors[i]);
    }
  }

  function distributeToMany(address[] _investors) external onlyOwner {
    for(uint32 i = 0; i < _investors.length; i++) {
      claimFor(_investors[i]);
    }
  }
}
