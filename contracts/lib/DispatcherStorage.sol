pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';

contract DispatcherStorage is Ownable {
  address public lib;

  constructor(address newLib) public {
    replace(newLib);
  }

  function replace(address newLib) public onlyOwner {
    lib = newLib;
  }
}

contract PaperDispatcherStorage is DispatcherStorage {
  constructor(address newLib) public DispatcherStorage(newLib) {}
}

contract ArtistDispatcherStorage is DispatcherStorage {
  constructor(address newLib) public DispatcherStorage(newLib) {}
}