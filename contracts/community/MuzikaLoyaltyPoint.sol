pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../../zeppelin-solidity/contracts/math/SafeMath.sol';
import '../token/MuzikaCoin.sol';

contract MuzikaLoyaltyPoint is Ownable {
  using SafeMath for uint256;

  string public name = 'MUZIKA LOYALTY POINT';
  string public symbol = 'MZKLP';
  uint8 public decimals = 18;

  MuzikaCoin internal _token = MuzikaCoin(0x9999888877776666555544443333222211110000);

  uint8 public exchangeRatio = 50;

  mapping (address => uint256) internal balances;

  event Reward(address indexed to, uint256 amount);
  event Exchange(address indexed to, uint256 fromAmount, uint256 toAmount);

  function balanceOf(address _owner) public view returns (uint256) {
    return balances[_owner];
  }

  function updateExchangeRatio(uint8 _ratio) public onlyOwner returns (bool) {
    exchangeRatio = _ratio;
    return true;
  }

  function reward(address _to, uint256 _amount) public onlyOwner returns (bool) {
    balances[_to] = balances[_to].add(_amount);
    emit Reward(_to, _amount);
    return true;
  }

  function exchange(address _to) public onlyOwner returns (bool) {
    require(balances[_to] > 0);
    uint256 amount = balances[_to];
    uint256 coinAmount = amount.div(100).mul(exchangeRatio);

    balances[_to] = 0;
    _token.transfer(_to, coinAmount);

    emit Exchange(_to, amount, coinAmount);
    return true;
  }

  function exchangeFromAddresses(address[] _people) public onlyOwner returns(bool) {
    for(uint8 i = 0; i < _people.length; i++) {
      address _to = _people[i];
      if (balances[_to] > 0) {
        uint256 amount = balances[_to];
        uint256 coinAmount = amount.div(100).mul(exchangeRatio);

        balances[_to] = 0;
        _token.transfer(_to, coinAmount);

        emit Exchange(_to, amount, coinAmount);
      }
    }

    return true;
  }
}
