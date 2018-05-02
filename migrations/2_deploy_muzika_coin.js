const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');
const sigUtil = require('eth-sig-util');

const MuzikaCoin = artifacts.require("MuzikaCoin");

module.exports = (deployer) => {
	const decimals = 18;
	const initialSupply = 1e8;

    let signedTypedDataSchema = [
        "bytes8 Mode",
        "address Token",
        "address To",
        "uint256 Amount",
        "uint256 Fee",
        "uint256 Nonce",
    ];

    let signedTypes = signedTypedDataSchema.map(v => v.split(' ')[0]);
    let schemaTypes = signedTypedDataSchema.map(v => 'string');

    let schemaPrefix = ethUtil.bufferToHex(ethAbi.soliditySHA3(schemaTypes, signedTypedDataSchema));

	deployer.deploy(MuzikaCoin, initialSupply * (10 ** decimals)).then(() => {
		const coinIns = MuzikaCoin.at(MuzikaCoin.address);
		return coinIns.upgradePrefixPreSignedSecond(3, schemaPrefix);
	});
};
