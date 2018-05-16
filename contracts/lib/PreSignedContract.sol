pragma solidity ^0.4.23;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';

contract PreSignedContract is Ownable {
  mapping (uint8 => bytes) internal _prefixPreSignedFirst;
  mapping (uint8 => bytes) internal _prefixPreSignedSecond;

  function upgradePrefixPreSignedFirst(uint8 _version, bytes _prefix) public onlyOwner {
    _prefixPreSignedFirst[_version] = _prefix;
  }

  function upgradePrefixPreSignedSecond(uint8 _version, bytes _prefix) public onlyOwner {
    _prefixPreSignedSecond[_version] = _prefix;
  }

  /**
   * @dev Recover signer address from a message by using their signature
   * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
   * @param sig bytes signature, the signature is generated using web3.eth.sign()
   */
  function recover(bytes32 hash, bytes sig) public pure returns (address) {
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

  function messagePreSignedHashing(
    bytes8 _mode,
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version
  ) public view returns (bytes32 hash) {
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
  ) public view returns (bytes32) {
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
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) public view returns (address) {
    bytes32 hash = preSignedHashing(
      _mode,
      _token,
      _to,
      _value,
      _fee,
      _nonce,
      _version
    );

    address _from = recover(hash, _sig);
    require(_from != address(0));

    return _from;
  }

  function transferPreSignedCheck(
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) external view returns (address) {
    return preSignedCheck('Transfer', _token, _to, _value, _fee, _nonce, _version, _sig);
  }

  function approvePreSignedCheck(
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) external view returns (address) {
    return preSignedCheck('Approval', _token, _to, _value, _fee, _nonce, _version, _sig);
  }

  function increaseApprovalPreSignedCheck(
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) external view returns (address) {
    return preSignedCheck('IncApprv', _token, _to, _value, _fee, _nonce, _version, _sig);
  }

  function decreaseApprovalPreSignedCheck(
    address _token,
    address _to,
    uint256 _value,
    uint256 _fee,
    uint256 _nonce,
    uint8 _version,
    bytes _sig
  ) external view returns (address) {
    return preSignedCheck('DecApprv', _token, _to, _value, _fee, _nonce, _version, _sig);
  }
}
