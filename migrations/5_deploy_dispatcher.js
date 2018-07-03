const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');

const MuzikaCoin = artifacts.require('MuzikaCoin');
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');
const PreSignedContract = artifacts.require('PreSignedContract');
const Dispatcher = artifacts.require('Dispatcher');
const DispatcherStorage = artifacts.require('DispatcherStorage');

const backedUpBytecode = Dispatcher.bytecode;
module.exports = (deployer) => {
	deployer.deploy(DispatcherStorage, '0x0000000000000000000000000000000000000000').then(() => {
		return DispatcherStorage.deployed();
	}).then(dispatcherStorage => {
		Dispatcher.bytecode = Dispatcher.bytecode
			.replace('1111222233334444555566667777888899990000', dispatcherStorage.address.slice(2));

		return deployer.deploy(Dispatcher);
	}).then(() => {
		Dispatcher.bytecode = backedUpBytecode;
	});
};