const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');

const MuzikaCoin = artifacts.require('MuzikaCoin');
const PreSignedContract = artifacts.require('PreSignedContract');
const LibArtistPayment = artifacts.require('LibArtistPayment');
const LibArtistPaymentInterface = artifacts.require('LibArtistPaymentInterface');
const ArtistDispatcherStorage = artifacts.require('ArtistDispatcherStorage');

const backedUpBytecode = LibArtistPayment.bytecode;
module.exports = (deployer) => {
	LibArtistPayment.bytecode = LibArtistPayment.bytecode
		.replace('9999888877776666555544443333222211110000', MuzikaCoin.address.slice(2));

	deployer.deploy(LibArtistPayment).then(() => {
		return ArtistDispatcherStorage.deployed();
	}).then(dispatcherStorage => {
		return dispatcherStorage.replace(LibArtistPayment.address);
	}).then(() => {
		LibArtistPayment.bytecode = backedUpBytecode;
	});
};
