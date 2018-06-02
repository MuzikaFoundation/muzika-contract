const HDWalletProvider = require("truffle-hdwallet-provider-privkey");
const privateKey = process.env.MUZIKA_PRIVATE_KEY;
const token = process.env.MUZIKA_INFURA_ACCESS_TOKEN;

function networkUrl (providerType) {
  switch (providerType) {
    case 'mainnet':
      return 'https://mainnet.infura.io/' + token;
    case 'ropsten':
      return 'https://ropsten.infura.io/' + token;
    case 'rinkeby':
      return 'https://rinkeby.infura.io/' + token;
  }
}

module.exports = function (providerType) {
  return function() {
    return new HDWalletProvider(privateKey, networkUrl(providerType));
  }
};
