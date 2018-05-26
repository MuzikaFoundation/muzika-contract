const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');
const sigUtil = require('eth-sig-util');
const contract = require('truffle-contract');

const PreSignedContract = artifacts.require("PreSignedContract");

module.exports = (deployer) => {
  deployer.deploy(PreSignedContract).then(preSignedContract => {
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
};
