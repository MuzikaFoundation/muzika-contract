pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract PublicSale is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public balances;         // remaining amount for releasing to each user in wei
  mapping (address => uint256) public raisedBy;         // raised amount by each user in wei
  mapping (address => uint256) public currentSteps;     // for releasing step per user

  ERC20 public token;
  uint256 public weiRaised;

  address public wallet;
  uint256 public rate;
  uint256 public minCapPerPerson;           // Minimum capability per person in wei
  uint256 public maxCapPerPerson;           // Maximum capability per person in wei
  uint256 public maxCap;                    // Maximum capped value in wei
  uint256 public saleStartTime;
  uint256 public saleEndTime;               // after saleEndTime, token will be able to be distributed

  uint256 public initialReleaseRatio;       // just after released, how amount of token will be distributed
  uint256 public releaseRatioPerStep;       // how many token will be released per step
  uint256 public totalStep;
  uint256 public daysInterval;

  event TokenPurchase(
    address indexed purchaser,
    address indexed beneficiary,
    uint256 value,
    uint256 amount
  );

  event Claim(
    address indexed claimer,
    address indexed beneficiary,
    uint256 step,
    uint256 amount
  );

  event Finalize(
    address indexed wallet,
    uint256 weiRaised,
    uint256 tokenReturn
  );

  modifier whenNotFinished() {
    require(saleStartTime <= now && now < saleEndTime);
    require(weiRaised <= maxCap);
    _;
  }

  modifier whenFinished() {
    require(saleEndTime <= now);
    _;
  }

  modifier canClaimFor(address _beneficiary) {
    require(now >= saleEndTime + currentSteps[_beneficiary] * daysInterval * 1 days);
    _;
  }

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
    uint256 _totalStep,
    uint256 _daysInterval
  ) public {
    require(_saleStartTime < _saleEndTime);
    require(_initialReleaseRatio <= 100);
    require(_releaseRatioPerStep <= 100);

    token = _token;
    wallet = _wallet;
    rate = _rate;
    minCapPerPerson = _minCapPerPerson;
    maxCapPerPerson = _maxCapPerPerson;
    maxCap = _maxCap;
    saleStartTime = _saleStartTime;
    saleEndTime = _saleEndTime;
    initialReleaseRatio = _initialReleaseRatio;
    releaseRatioPerStep = _releaseRatioPerStep;
    totalStep = _totalStep;
    daysInterval = _daysInterval;
  }

  function() external payable {
    buyToken(msg.sender);
  }

  function buyToken(address _beneficiary) public payable whenNotFinished {
    require(_beneficiary != address(0));

    uint256 weiAmount = calcRaisedAmount(_beneficiary, msg.value);
    uint256 refundAmount = msg.value.sub(weiAmount);
    uint256 tokenAmount = calcTokenAmount(weiAmount);

    weiRaised = weiRaised.add(weiAmount);
    balances[_beneficiary] = balances[_beneficiary].add(weiAmount);
    raisedBy[_beneficiary] = raisedBy[_beneficiary].add(weiAmount);

    emit TokenPurchase(
      msg.sender,
      _beneficiary,
      weiAmount,
      tokenAmount
    );

    if (refundAmount > 0) {
      msg.sender.transfer(refundAmount);
    }
  }

  function calcTokenAmount(uint256 _weiAmount) public view returns (uint256) {
    return _weiAmount.mul(rate);
  }

  function calcReleasableAmountInWei(uint256 _step, address _beneficiary) public view returns (uint256) {
    if (_step == totalStep) {
      return balances[_beneficiary];
    }

    uint256 ratio = _step == 0 ? initialReleaseRatio : releaseRatioPerStep;
    uint256 amount = raisedBy[_beneficiary].mul(ratio).div(100);

    return amount > balances[_beneficiary] ? balances[_beneficiary] : amount;
  }

  function calcRaisedAmount(address _beneficiary, uint256 _weiAmount) public view returns (uint256) {
    require(minCapPerPerson <= _weiAmount);
    require(maxCapPerPerson >= raisedBy[_beneficiary].add(_weiAmount));
    if (weiRaised.add(_weiAmount) <= maxCap) {
      return _weiAmount;
    } else {
      return maxCap.sub(weiRaised);
    }
  }

  function claim() external {
    claimFor(msg.sender);
  }

  function claimFor(address _beneficiary) public whenFinished canClaimFor(_beneficiary) {
    require(balances[_beneficiary] > 0);

    uint256 currentStep = currentSteps[_beneficiary];
    uint256 weiAmount = calcReleasableAmountInWei(currentStep, _beneficiary);
    uint256 amount = calcTokenAmount(weiAmount);

    balances[_beneficiary] = balances[_beneficiary].sub(weiAmount);
    currentSteps[_beneficiary] = currentSteps[_beneficiary].add(1);

    require(token.transfer(_beneficiary, amount));

    emit Claim(msg.sender, _beneficiary, currentStep, amount);
  }

  function distribute(address[] _investors) external onlyOwner {
    require(_investors.length < (2**32));
    for(uint32 i = 0; i < _investors.length; i++) {
      claimFor(_investors[i]);
    }
  }

  function finalize() external onlyOwner whenFinished returns (bool) {
    uint256 weiAmount = address(this).balance;
    // return unsold tokens
    uint256 tokenAmount = calcTokenAmount(maxCap.sub(weiRaised));

    wallet.transfer(weiAmount);
    require(token.transfer(wallet, tokenAmount));

    emit Finalize(wallet, weiAmount, tokenAmount);

    return true;
  }
}
