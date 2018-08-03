require('babel-register');
require('babel-polyfill');

const newProvider = require('./config/truffle.provider.js');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*'
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    mainnet: {
      provider: newProvider('mainnet'),
      network_id: 1,
      gas: 500000,
      gasPrice: 12000000000 // 12 Gwei
    },
    ropsten: {
      provider: newProvider('ropsten'),
      network_id: 3,
      gas: 3000000
    },
    rinkeby: {
      provider: newProvider('rinkeby'),
      network_id: 4,
      gas: 3000000
    }
  },
  solc: {
    optimizer: {
      // disabled by default
      enabled: true,
      // Optimize for how many times you intend to run the code.
      // Lower values will optimize more for initial deployment cost, higher values will optimize more for high-frequency usage.
      runs: 200
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter'
  }
};
