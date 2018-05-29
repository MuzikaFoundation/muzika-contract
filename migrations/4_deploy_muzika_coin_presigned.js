const MuzikaCoinPreSigned = artifacts.require("MuzikaCoinPreSigned");
const PreSignedContract = artifacts.require("PreSignedContract");

const backedUpBytecode = MuzikaCoinPreSigned.bytecode;
module.exports = (deployer) => {
  const decimals = 18;
  const initialSupply = 1e8;

  deployer.then(() => {
    return PreSignedContract.deployed();
  }).then(preSignedContract => {
    MuzikaCoinPreSigned.bytecode = MuzikaCoinPreSigned.bytecode
      .replace('1111222233334444555566667777888899990000', preSignedContract.address.slice(2));

    return deployer.deploy(MuzikaCoinPreSigned, initialSupply * (10 ** decimals));
  }).then(() => {
    MuzikaCoinPreSigned.bytecode = backedUpBytecode;
  });
};
