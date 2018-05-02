pragma solidity ^0.4.23;

import '../../zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import '../../zeppelin-solidity/contracts/lifecycle/Pausable.sol';


contract MuzikaCoin is MintableToken, Pausable {
  string public name = 'MUZIKA COIN';
  string public symbol = 'MZK';
  uint8 public decimals = 18;

  bytes8 constant internal MODE_TRANSFER = 'Transfer';
  bytes8 constant internal MODE_APPROVAL = 'Approval';
  bytes8 constant internal MODE_INC_APPROVAL = 'IncApprv';
  bytes8 constant internal MODE_DEC_APPROVAL = 'DecApprv';

  event Burn(address indexed burner, uint256 value);

  event FreezeAddress(address indexed target);
  event UnfreezeAddress(address indexed target);

  /* Need?
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
  */

  mapping (address => bool) public frozenAddress;

  mapping (bytes => bool) _signatures;

  mapping (uint8 => bytes) internal _prefixPreSignedFirst;
  mapping (uint8 => bytes) internal _prefixPreSignedSecond;

  modifier onlyNotFrozenAddress(address _target) {
    require(!frozenAddress[_target], 'The address is frozen');
    _;
  }

  modifier onlyFrozenAddress(address _target) {
    require(frozenAddress[_target], 'The address is not frozen');
    _;
  }

  constructor(uint256 initialSupply) public {
    totalSupply_ = initialSupply;
    balances[msg.sender] = initialSupply;
    emit Transfer(0x0, msg.sender, initialSupply);
  }

  function upgradePrefixPreSignedFirst(uint8 _version, bytes _prefix) 
    public 
    onlyOwner 
  {
    _prefixPreSignedFirst[_version] = _prefix;
  }

  function upgradePrefixPreSignedSecond(uint8 _version, bytes _prefix) 
    public 
    onlyOwner 
  {
    _prefixPreSignedSecond[_version] = _prefix;
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
    require(_value <= balances[_who], 'Not enough amount to be burned');
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
    onlyNotFrozenAddress(_from)
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    require(_to != address(0), 'Cannot transfer to zero-address');

    address _from = preSignedCheck(
      MODE_TRANSFER,
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    uint256 _burden = _value.add(_fee);
    require(_burden <= balances[_from], 'Not enough amount to be transferred');

    balances[_from] = balances[_from].sub(_burden);

    balances[_to] = balances[_to].add(_value);
    emit Transfer(_from, _to, _value);

    balances[msg.sender] = balances[msg.sender].add(_fee);
    emit Transfer(_from, msg.sender, _fee);

    _signatures[_sig] = true;

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
    onlyNotFrozenAddress(_from)
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    address _from = preSignedCheck(
      MODE_APPROVAL,
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    require(_fee <= balances[_from], 'Not enough amount to be transferred');

    allowed[_from][_to] = _value;
    emit Approval(_from, _to, _value);

    balances[_from] = balances[_from].sub(_fee);
    balances[msg.sender] = balances[msg.sender].add(_fee);
    emit Transfer(_from, msg.sender, _fee);

    _signatures[_sig] = true;

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
    onlyNotFrozenAddress(_from)
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    address _from = preSignedCheck(
      MODE_INC_APPROVAL,
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    require(_fee <= balances[_from], 'Not enough amount to be transferred');

    allowed[_from][_to] = allowed[_from][_to].add(_value);
    emit Approval(_from, _to, allowed[_from][_to]);

    balances[_from] = balances[_from].sub(_fee);
    balances[msg.sender] = balances[msg.sender].add(_fee);
    emit Transfer(_from, msg.sender, _fee);

    _signatures[_sig] = true;

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
    onlyNotFrozenAddress(_from)
    onlyNotFrozenAddress(msg.sender)
    whenNotPaused
    returns (bool)
  {
    address _from = preSignedCheck(
      MODE_DEC_APPROVAL,
      _to,
      _value,
      _fee,
      _nonce,
      _version,
      _sig
    );

    require(_fee <= balances[_from], 'Not enough amount to be transferred');

    uint256 oldValue = allowed[_from][_to];
    if (_value > oldValue) {
      oldValue = 0;
    } else {
      oldValue = oldValue.sub(_value);
    }
    allowed[_from][_to] = oldValue;
    emit Approval(_from, _to, oldValue);

    balances[_from] = balances[_from].sub(_fee);
    balances[msg.sender] = balances[msg.sender].add(_fee);
    emit Transfer(_from, msg.sender, _fee);

    _signatures[_sig] = true;

    return true;
  }

  function messagePreSignedHashing(
    bytes8 _mode,
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version
  )
    public view returns (bytes32 hash)
  {
    if (_version <= 2) {
      hash = keccak256(
        _mode,
        _token,
        _to,
        _value,
        _fee,
        _nonce
      );
    } else {
      // Support SignTypedData flexibly
      hash = keccak256(
        _prefixPreSignedFirst[_version],
        _mode,
        _token,
        _to,
        _value,
        _fee,
        _nonce
      );
    }
  }

  function preSignedHashing(
    bytes8 _mode,
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version
  )
    public view returns (bytes32)
  {
    bytes32 hash = messagePreSignedHashing(
      _mode,
      _token,
      _to,
      _value,
      _fee,
      _nonce,
      _version
    );

    if (_version <= 2) {
      if (_version == 0) {
        return hash;
      } else if (_version == 1) {
        return keccak256(
          '\x19Ethereum Signed Message:\n32',
          hash
        );
      } else {
        // Support Standard Prefix (Trezor)
        return keccak256(
          '\x19Ethereum Signed Message:\n\x20',
          hash
        );
      }
    } else {
      // Support SignTypedData flexibly
      if (_prefixPreSignedSecond[_version].length > 0) {
        return keccak256(
          _prefixPreSignedSecond[_version],
          hash
        );
      } else {
        return hash;
      }
    }
  }

  function preSignedCheck(
    bytes8 _mode,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  )
  internal view returns (address)
  {
    require(_signatures[_sig] == false, 'Already done');

    bytes32 hash = preSignedHashing(
      _mode,
      address(this),
      _to,
      _value,
      _fee,
      _nonce,
      _version
    );

    address _from = recover(hash, _sig);
    require(_from != address(0), 'Authorization failed');

    return _from;
  }

  /**
   * @dev Recover signer address from a message by using their signature
   * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
   * @param sig bytes signature, the signature is generated using web3.eth.sign()
   */
  function recover(bytes32 hash, bytes sig) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    // Check the signature length
    if (sig.length != 65) {
      return (address(0));
    }

    // Divide the signature in r, s and v variables
    // ecrecover takes the signature parameters, and the only way to get them
    // currently is to use assembly.
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := byte(0, mload(add(sig, 96)))
    }

    // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
    if (v < 27) {
      v += 27;
    }

    // If the version is correct return the signer address
    if (v != 27 && v != 28) {
      return (address(0));
    } else {
      // solium-disable-next-line arg-overflow
      return ecrecover(hash, v, r, s);
    }
  }
}
