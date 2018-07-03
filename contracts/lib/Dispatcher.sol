pragma solidity ^0.4.24;

import './DispatcherStorage.sol';

contract Dispatcher {
  function() public {
    DispatcherStorage dispatcherStorage = DispatcherStorage(0x1111222233334444555566667777888899990000);
    address target = dispatcherStorage.lib();
    bool callSuccess = target.delegatecall(msg.data);

    if (callSuccess) {
      // solium-disable-next-line security/no-inline-assembly
      assembly {
        returndatacopy(0x0, 0x0, returndatasize)
        return(0x0, returndatasize)
      }
    } else {
      revert();
    }
  }
}

contract ArtistDispatcher is Dispatcher {
}

contract PaperDispatcher is Dispatcher {

}