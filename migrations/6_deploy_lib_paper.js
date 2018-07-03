const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');

const MuzikaCoin = artifacts.require('MuzikaCoin');
const PreSignedContract = artifacts.require('PreSignedContract');
const LibPaperPayment = artifacts.require('LibPaperPayment');
const LibPaperPaymentInterface = artifacts.require('LibPaperPaymentInterface');
const PaperDispatcherStorage = artifacts.require('PaperDispatcherStorage');

const backedUpBytecode = LibPaperPayment.bytecode;
module.exports = (deployer) => {
  LibPaperPayment.bytecode = LibPaperPayment.bytecode
    .replace('1111222233334444555566667777888899990000', PreSignedContract.address.slice(2))
    .replace('9999888877776666555544443333222211110000', MuzikaCoin.address.slice(2));

  deployer.deploy(LibPaperPayment).then(() => {
    return PaperDispatcherStorage.deployed();
  }).then(dispatcherStorage => {
    return dispatcherStorage.replace(LibPaperPayment.address);
  }).then(() => {
    LibPaperPayment.bytecode = backedUpBytecode;
  });
};
