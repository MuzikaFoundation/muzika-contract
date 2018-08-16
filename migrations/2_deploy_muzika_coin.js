const ethUtil = require('ethereumjs-util');
const ethAbi = require('ethereumjs-abi');
const sigUtil = require('eth-sig-util');
const contract = require('truffle-contract');

const MuzikaCoin = artifacts.require("MuzikaCoin");

module.exports = (deployer) => {
  const decimals = 18;
  const initialSupply = 1e9;

  deployer.deploy(MuzikaCoin, initialSupply * (10 ** decimals));
};
