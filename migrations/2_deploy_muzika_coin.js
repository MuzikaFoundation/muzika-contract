const MuzikaCoin = artifacts.require("MuzikaCoin");

module.exports = (deployer) => {
	const decimals = 18;
	const initialSupply = 1e8;

	deployer.deploy(MuzikaCoin, initialSupply * (10 ** decimals)).then(() => {
		const coinIns = MuzikaCoin.at(MuzikaCoin.address);
		coinIns.upgradePrefixPreSignedSecond(3, '0x261f7a1df786c3890560458cad5bc0f68cc35032a1d6e147280ce4a9addac22d');
	});
};
