pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract TokenVault is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public balances;

  ERC20 public token;
  uint256 public investorCount;
  uint256 public totalToken;

  event Raise(address indexed investor, uint256 amount);
  event Claim(
    address indexed claimer,
    address indexed beneficiary,
    uint256 amount
  );

  constructor(ERC20 _token) public {
    token = _token;
  }

  function setInvestor(address _investor, uint256 _value) external onlyOwner {
    require(_value > 0);
    require(balances[_investor] == 0);

    balances[_investor] = _value;
    investorCount++;
    totalToken = totalToken.add(_value);

    emit Raise(_investor, _value);
  }

  function claim() external {
    claimBy(msg.sender);
  }

  function claimBy(address _beneficiary) public {
    require(balances[_beneficiary] > 0);

    uint256 amount = balances[_beneficiary];

    balances[_beneficiary] = 0;

    token.transfer(_beneficiary, amount);

    emit Claim(msg.sender, _beneficiary, amount);
  }
}
