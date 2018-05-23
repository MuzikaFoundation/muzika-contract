pragma solidity ^0.4.24;

import "./DispatcherStorage.sol";

contract Dispatcher {
  function() public {
    DispatcherStorage dispatcherStorage = DispatcherStorage(0x1111222233334444555566667777888899990000);
    address target = dispatcherStorage.lib();

    assembly {
      calldatacopy(0x0, 0x0, calldatasize)
      let success := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0x0, 0)
      let retSz := returndatasize
      returndatacopy(0x0, 0x0, retSz)
      switch success
      case 0 {
        revert(0x0, retSz)
      }
      default {
        return(0x0, retSz)
      }
    }
  }
}
