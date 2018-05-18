pragma solidity ^0.4.23;

import '../../zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import '../../zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import '../lib/PreSignedContract.sol';

contract MuzikaCoin is MintableToken, Pausable {
  string public name = 'MUZIKA COIN';
  string public symbol = 'MZK';
  uint8 public decimals = 18;

  event Burn(address indexed burner, uint256 value);

  event FreezeAddress(address indexed target);
  event UnfreezeAddress(address indexed target);

  event TransferPreSigned(
    address indexed from,
    address indexed to,
    address indexed delegate,
    uint256 value,
    uint256 fee
  );
  event ApprovalPreSigned(
    address indexed owner,
    address indexed spender,
    address indexed delegate,
    uint256 value,
    uint256 fee
  );

  mapping (address => bool) public frozenAddress;

  mapping (bytes => bool) internal _signatures;

  PreSignedContract internal _preSignedContract = PreSignedContract(0x1111222233334444555566667777888899990000);

  modifier onlyNotFrozenAddress(address _target) {
    require(!frozenAddress[_target]);
    _;
  }

  modifier onlyFrozenAddress(address _target) {
    require(frozenAddress[_target]);
    _;
  }

  constructor(uint256 initialSupply) public {
    totalSupply_ = initialSupply;
    balances[msg.sender] = initialSupply;
    emit Transfer(address(0), msg.sender, initialSupply);
  }

  /**
   * @dev Freeze account(address)
   *
   * @param _target The address to freeze
   */
  function freezeAddress(address _target)
    public
    onlyOwner
    onlyNotFrozenAddress(_target)
  {
    frozenAddress[_target] = true;

    emit FreezeAddress(_target);
  }

  /**
   * @dev Unfreeze account(address)
   *
   * @param _target The address to unfreeze
   */
  function unfreezeAddress(address _target)
    public
    onlyOwner
    onlyFrozenAddress(_target)
  {
    delete frozenAddress[_target];

    emit UnfreezeAddress(_target);
  }

  /**
   * @dev Burns a specific amount of tokens.
   * @param _value The amount of token to be burned.
   */
  function burn(uint256 _value) public onlyOwner {
    _burn(msg.sender, _value);
  }

  function _burn(address _who, uint256 _value) internal {
    require(_value <= balances[_who]);
    // no need to require value <= totalSupply, since that would imply the
    // sender's balance is greater than the totalSupply, which *should* be an assertion failure

    balances[_who] = balances[_who].sub(_value);
    totalSupply_ = totalSupply_.sub(_value);
    emit Burn(_who, _value);
    emit Transfer(_who, address(0), _value);
  }

  function transfer(
    address _to,
    uint256 _value
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    return super.transfer(_to, _value);
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    onlyNotFrozenAddress(_from)
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    return super.transferFrom(_from, _to, _value);
  }

  function approve(
    address _spender,
    uint256 _value
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    return super.approve(_spender, _value);
  }

  function increaseApproval(
    address _spender,
    uint _addedValue
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    return super.increaseApproval(_spender, _addedValue);
  }

  function decreaseApproval(
    address _spender,
    uint _subtractedValue
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    return super.decreaseApproval(_spender, _subtractedValue);
  }

  /**
   * @dev Be careful to use delegateTransfer.
   * @dev If attacker whose balance is less than sum of fee and amount
   * @dev requests constantly transferring using delegateTransfer/delegateApprove to someone,
   * @dev he or she may lose all ether to process these requests.
   */
  function transferPreSigned(
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0));
    require(_signatures[_sig] == false);

    address _from = _preSignedContract.transferPreSignedCheck(
      address(this),
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );
    require(!frozenAddress[_from]);

    uint256 _burden = _value.add(_fee);
    require(_burden <= balances[_from]);

    balances[_from] = balances[_from].sub(_burden);
    balances[_to] = balances[_to].add(_value);
    balances[msg.sender] = balances[msg.sender].add(_fee);
    emit Transfer(_from, _to, _value);
    emit Transfer(_from, msg.sender, _fee);

    _signatures[_sig] = true;
    emit TransferPreSigned(_from, _to, msg.sender, _value, _fee);

    return true;
  }

  function approvePreSigned(
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    require(_signatures[_sig] == false);

    address _from = _preSignedContract.approvePreSignedCheck(
      address(this),
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    require(!frozenAddress[_from]);
    require(_fee <= balances[_from]);

    allowed[_from][_to] = _value;
    emit Approval(_from, _to, _value);

    if (_fee > 0) {
      balances[_from] = balances[_from].sub(_fee);
      balances[msg.sender] = balances[msg.sender].add(_fee);
      emit Transfer(_from, msg.sender, _fee);
    }

    _signatures[_sig] = true;
    emit ApprovalPreSigned(_from, _to, msg.sender, _value, _fee);

    return true;
  }

  function increaseApprovalPreSigned(
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    require(_signatures[_sig] == false);

    address _from = _preSignedContract.increaseApprovalPreSignedCheck(
      address(this),
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    require(!frozenAddress[_from]);
    require(_fee <= balances[_from]);

    allowed[_from][_to] = allowed[_from][_to].add(_value);
    emit Approval(_from, _to, allowed[_from][_to]);

    if (_fee > 0) {
      balances[_from] = balances[_from].sub(_fee);
      balances[msg.sender] = balances[msg.sender].add(_fee);
      emit Transfer(_from, msg.sender, _fee);
    }

    _signatures[_sig] = true;
    emit ApprovalPreSigned(_from, _to, msg.sender, allowed[_from][_to], _fee);

    return true;
  }

  function decreaseApprovalPreSigned(
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  )
    public
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    require(_signatures[_sig] == false);

    address _from = _preSignedContract.decreaseApprovalPreSignedCheck(
      address(this),
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );
    require(!frozenAddress[_from]);

    require(_fee <= balances[_from]);

    uint256 oldValue = allowed[_from][_to];
    if (_value > oldValue) {
      oldValue = 0;
    } else {
      oldValue = oldValue.sub(_value);
    }

    allowed[_from][_to] = oldValue;
    emit Approval(_from, _to, oldValue);

    if (_fee > 0) {
      balances[_from] = balances[_from].sub(_fee);
      balances[msg.sender] = balances[msg.sender].add(_fee);
      emit Transfer(_from, msg.sender, _fee);
    }

    _signatures[_sig] = true;
    emit ApprovalPreSigned(_from, _to, msg.sender, oldValue, _fee);

    return true;
  }
}
