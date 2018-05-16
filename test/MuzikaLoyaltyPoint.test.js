import {promisify} from './helpers/promisify';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const PreSignedContract = artifacts.require('PreSignedContract');
const MuzikaLoyaltyPoint = artifacts.require('MuzikaLoyaltyPoint');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MuzikaLoyaltyPoint', ([_, owner, recipient, anotherAccount]) => {
  const initialSupply = 10000;
  const exchangeRatio = 80;

  let token;
  let loyalty;

  let backedUpByteCode = MuzikaLoyaltyPoint.unlinked_binary;

  afterEach(() => {
    // Restore bytecode of paper contract
    MuzikaLoyaltyPoint.unlinked_binary = backedUpByteCode;
  });

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});

    /* Manually replace address of PreSignedContract in compile stage
     * So, you should not be input to the constructor on contracts
     */
    MuzikaLoyaltyPoint.unlinked_binary = MuzikaLoyaltyPoint.unlinked_binary
      .replace('9999888877776666555544443333222211110000', token.address.slice(2));

    loyalty = await MuzikaLoyaltyPoint.new({from: owner});

    await loyalty.updateExchangeRatio(exchangeRatio, {from: owner});
    await token.transfer(loyalty.address, 5000, {from: owner});
  });

  it('exchanges from loyalty points to muzika coin', async () => {
    const lpAmount = 1000;
    await loyalty.reward(recipient, lpAmount, {from: owner});
    await loyalty.exchange(recipient, {from: owner});

    const balance = await token.balanceOf(recipient);

    balance.should.be.bignumber.equal(lpAmount / 100 * exchangeRatio);
  });
});
