const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');

const MuzikaCoin = artifacts.require('MuzikaCoin');
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');
const PreSignedContract = artifacts.require('PreSignedContract');
const PaperDispatcher = artifacts.require('PaperDispatcher');
const ArtistDispatcher = artifacts.require('ArtistDispatcher');
const PaperDispatcherStorage = artifacts.require('PaperDispatcherStorage');
const ArtistDispatcherStorage = artifacts.require('ArtistDispatcherStorage');

const backedUpBytecode = PaperDispatcher.bytecode;
const backedUpArtistDispatcherBytecode = ArtistDispatcher.bytecode;
module.exports = (deployer) => {
  deployer.deploy(PaperDispatcherStorage, '0x0000000000000000000000000000000000000000').then(() => {
    return PaperDispatcherStorage.deployed();
  }).then(dispatcherStorage => {
    PaperDispatcher.bytecode = PaperDispatcher.bytecode
      .replace('1111222233334444555566667777888899990000', dispatcherStorage.address.slice(2));

    return deployer.deploy(PaperDispatcher);
  }).then(() => {
    PaperDispatcher.bytecode = backedUpBytecode;
  });

	deployer.deploy(ArtistDispatcherStorage, '0x0000000000000000000000000000000000000000').then(() => {
		return ArtistDispatcherStorage.deployed();
	}).then(dispatcherStorage => {
		ArtistDispatcher.bytecode = ArtistDispatcher.bytecode
			.replace('1111222233334444555566667777888899990000', dispatcherStorage.address.slice(2));

		return deployer.deploy(ArtistDispatcher);
	}).then(() => {
		ArtistDispatcher.bytecode = backedUpArtistDispatcherBytecode;
	});
};
