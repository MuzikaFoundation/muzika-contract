pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../../zeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import '../../zeppelin-solidity/contracts/math/SafeMath.sol';

contract Crowdsale is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public balances; // raised fund in wei per person

  ERC20 public token;
  address public wallet;
  uint256 public rate;
  uint256 public minCapPerPerson; // Minimum capability per person in wei
  uint256 public maxCapPerPerson; // Maximum capability per person in wei
  uint256 public maxCap; // Maximum capped value in wei
  uint256 public startBlockNumber;
  uint256 public endBlockNumber;

  uint256 public weiRaised;

  event TokenPurchase(
    address indexed purchaser,
    address indexed beneficiary,
    uint256 value,
    uint256 amount
  );

  event Claim(
    address indexed claimer,
    address indexed beneficiary,
    uint256 amount
  );

  event Finalize(
    address indexed wallet,
    uint256 weiRaised,
    uint256 tokenReturn
  );

  modifier whenNotFinished() {
    require(startBlockNumber <= block.number && block.number < endBlockNumber);
    require(weiRaised <= maxCap);
    _;
  }

  modifier whenFinished() {
    require(endBlockNumber <= block.number);
    _;
  }

  constructor(
    ERC20 _token,
    address _wallet,
    uint256 _rate,
    uint256 _minCapPerPerson,
    uint256 _maxCapPerPerson,
    uint256 _maxCap,
    uint256 _startBlockNumber,
    uint256 _endBlockNumber
  ) public {
    require(_startBlockNumber < _endBlockNumber);

    token = _token;
    wallet = _wallet;
    rate = _rate;
    minCapPerPerson = _minCapPerPerson;
    maxCapPerPerson = _maxCapPerPerson;
    maxCap = _maxCap;
    startBlockNumber = _startBlockNumber;
    endBlockNumber = _endBlockNumber;
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

  function calcRaisedAmount(address _beneficiary, uint256 _weiAmount) public view returns (uint256) {
    require(minCapPerPerson <= _weiAmount);
    require(maxCapPerPerson >= balances[_beneficiary].add(_weiAmount));
    if (weiRaised.add(_weiAmount) <= maxCap) {
      return _weiAmount;
    } else {
      return maxCap.sub(weiRaised);
    }
  }

  function claim() external whenFinished {
    claimBy(msg.sender);
  }

  function claimBy(address _beneficiary) public whenFinished {
    require(balances[_beneficiary] > 0);

    uint256 tokenAmount = calcTokenAmount(balances[_beneficiary]);

    balances[_beneficiary] = 0;

    token.transfer(_beneficiary, tokenAmount);

    emit Claim(msg.sender, _beneficiary, tokenAmount);
  }

  function distribute(address[] _people) external onlyOwner whenFinished {
    for(uint32 i = 0; i < _people.length; i++) {
      claimBy(_people[i]);
    }
  }

  function finalize() external onlyOwner whenFinished returns (bool) {
    uint256 weiAmount = address(this).balance;
    // return unsold tokens
    uint256 tokenAmount = calcTokenAmount(maxCap.sub(weiRaised));

    wallet.transfer(weiAmount);
    token.transfer(wallet, tokenAmount);

    emit Finalize(wallet, weiAmount, tokenAmount);

    return true;
  }
}
