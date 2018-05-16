const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');
const sigUtil = require('eth-sig-util');
const contract = require('truffle-contract');

const MuzikaCoin = artifacts.require("MuzikaCoin");
const PreSignedContract = artifacts.require("PreSignedContract");

module.exports = (deployer) => {
  const decimals = 18;
  const initialSupply = 1e8;

  deployer.deploy(PreSignedContract).then(() => {
    return PreSignedContract.deployed();
  }).then(preSignedContract => {
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

    return preSignedContract.upgradePrefixPreSignedSecond(3, schemaPrefix);
  });

  deployer.then(() => {
    return PreSignedContract.deployed();
  }).then(preSignedContract => {
    MuzikaCoin.unlinked_binary = MuzikaCoin.unlinked_binary
      .replace('1111222233334444555566667777888899990000', preSignedContract.address.slice(2));

    return deployer.deploy(MuzikaCoin, initialSupply * (10 ** decimals));
  });
};
