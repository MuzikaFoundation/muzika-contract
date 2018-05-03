const MuzikaCoin = artifacts.require("MuzikaCoin");
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');

module.exports = (deployer) => {
	deployer.then(() => {
		return MuzikaCoin.deployed();
	}).then((muzikaCoinIns) => {
		// Heartbeat Timeout: 7 days
		const heartbeatTimeout = 7 * 24 * 3600;
		return deployer.deploy(MuzikaPaperContract, MuzikaCoin.address, heartbeatTimeout);
	});
};
