import {assertRevert} from './helpers/assertRevert';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const TokenVault = artifacts.require('TokenVault');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('TokenVault', ([_, owner, investor1, investor2, anotherAccount]) => {
  const initialSupply = 10000;
  let token;
  let tokenVault;

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});
    tokenVault = await TokenVault.new(token.address, {from: owner});

    await token.transfer(tokenVault.address, 5000, {from: owner});
  });

  it('should be claimed', async () => {
    await tokenVault.setInvestor(investor1, 500, {from: owner});

    await tokenVault.claim({from: investor1});

    const balance = await token.balanceOf(investor1);

    balance.should.be.bignumber.equal(500);
  });

  it('should be claimed by other', async () => {
    await tokenVault.setInvestor(investor1, 500, {from: owner});
    await tokenVault.setInvestor(investor2, 1500, {from: owner});

    await tokenVault.claimBy(investor1, {from: owner});
    await tokenVault.claimBy(investor2, {from: owner});

    const balance1 = await token.balanceOf(investor1);
    const balance2 = await token.balanceOf(investor2);

    balance1.should.be.bignumber.equal(500);
    balance2.should.be.bignumber.equal(1500);
  });
});
