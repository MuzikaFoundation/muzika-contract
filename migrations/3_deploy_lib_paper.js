const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');

const MuzikaCoin = artifacts.require('MuzikaCoin');
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');
const PreSignedContract = artifacts.require('PreSignedContract');
const LibPaperPayment = artifacts.require('LibPaperPayment');
const LibPaperPaymentInterface = artifacts.require('LibPaperPaymentInterface');
const Dispatcher = artifacts.require('Dispatcher');
const DispatcherStorage = artifacts.require('DispatcherStorage');

module.exports = (deployer) => {
  deployer.deploy(DispatcherStorage, '0x0000000000000000000000000000000000000000').then(() => {
    return DispatcherStorage.deployed();
  }).then(dispatcherStorage => {
    Dispatcher.unlinked_binary = Dispatcher.unlinked_binary
      .replace('1111222233334444555566667777888899990000', dispatcherStorage.address.slice(2));

    return deployer.deploy(Dispatcher);
  }).then(() => {
    return Dispatcher.deployed();
  });
};
