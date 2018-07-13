import {assertRevert} from './helpers/assertRevert';
import {promisify} from './helpers/promisify';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const Crowdsale = artifacts.require('Crowdsale');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('Crowdsale', ([_, owner, wallet, investor1, investor2]) => {
  const initialSupply = 100000;
  const rate = 5;
  const maxCap = 5000;
  const minCapPerPerson = 50;
  const maxCapPerPerson = 1000;

  let token;
  let crowdsale;
  let startBlockNumber;
  let endBlockNumber;
  let currentBlockNumber;

  /**
   * Generate junk transactions
   *
   * @param repeat
   * @returns {Promise<void>}
   */
  const genJunkTxs = async (repeat) => {
    for(let i = 0; i < repeat; i++) {
      await promisify(web3.eth.sendTransaction, {from: _, to: _, value: 0, gasPrice: 0});
    }
  };

  /**
   * Virtual sales to reach the amount
   *
   * @param amount - amount of expectation sales
   * @returns {Promise<string[]>}
   */
  const virtualTokenSale = async (amount) => {
    const numOfNeededAccount = Math.ceil(amount / maxCapPerPerson);
    const addresses = [];

    for(let i = 0; i < numOfNeededAccount; i++) {
      const value = amount < maxCapPerPerson ? amount : maxCapPerPerson;
      const address = Buffer.alloc(20);
      address.writeUInt32BE(i + 100, 0);
      await crowdsale.buyToken('0x' + address.toString('hex'), {from: _, value: value, gasPrice: 0});
      amount -= value;
      addresses.push('0x' + address.toString('hex'));
    }

    return addresses;
  };

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});

    currentBlockNumber = parseInt(await promisify(web3.eth.getBlockNumber));

    startBlockNumber = currentBlockNumber;
    endBlockNumber = currentBlockNumber + 20;

    crowdsale = await Crowdsale.new(
      token.address,
      wallet,
      rate,
      minCapPerPerson,
      maxCapPerPerson,
      maxCap,
      startBlockNumber,
      endBlockNumber,
      {from: owner}
    );
    await token.transfer(crowdsale.address, maxCap * rate, {from: owner});

    currentBlockNumber = parseInt(await promisify(web3.eth.getBlockNumber));
  });

  it('should be sold in period between startBlockNumber and endBlockNumber', async () => {
    startBlockNumber = currentBlockNumber + 10;
    endBlockNumber = currentBlockNumber + 20;

    // startBlockNumber + 1
    crowdsale = await Crowdsale.new(
      token.address,
      wallet,
      rate,
      minCapPerPerson,
      maxCapPerPerson,
      maxCap,
      startBlockNumber,
      endBlockNumber
    );

    // startBlockNumber + 2
    await token.transfer(crowdsale.address, maxCap * rate, {from: owner});

    const value = 500;

    await assertRevert(crowdsale.sendTransaction({from: investor1, value: value}));

    // garbage transactions to begin sale
    await genJunkTxs(10);

    const beforePurchase = await promisify(web3.eth.getBalance, investor1);
    await crowdsale.sendTransaction({from: investor1, value: value, gasPrice: 0});
    const afterPurchase = await promisify(web3.eth.getBalance, investor1);

    const purchaseValue = await crowdsale.balances(investor1);
    const weiRaised = await crowdsale.weiRaised();

    purchaseValue.should.be.bignumber.equal(value);
    weiRaised.should.be.bignumber.equal(value);
    afterPurchase.should.be.bignumber.equal(beforePurchase.sub(value));

    // garbage transactions to stop
    await genJunkTxs(10);

    await assertRevert(crowdsale.sendTransaction({from: investor2, value: value}));
  });

  it('should refund when transferred value exceed maximum cap', async () => {
    const remainValue = 200;
    const transferValue = 800;

    await virtualTokenSale(maxCap - remainValue);

    const beforeWei = await promisify(web3.eth.getBalance, investor1);
    await crowdsale.sendTransaction({from: investor1, value: transferValue, gasPrice: 0});
    const afterWei = await promisify(web3.eth.getBalance, investor1);

    const weiRaised = await crowdsale.weiRaised();
    const purchaseValue = await crowdsale.balances(investor1);

    weiRaised.should.be.bignumber.equal(maxCap);
    purchaseValue.should.be.bignumber.equal(remainValue);
    afterWei.should.be.bignumber.equal(beforeWei.sub(remainValue));
  });

  it('should revert when maximum capability per person is exceeded', async () => {
    const tooSmallValue = minCapPerPerson - 10;
    const exceededValue = maxCapPerPerson + 100;
    const oneMoreTransfer = maxCapPerPerson / 2 + 100; // if someone transfers to contract two or more times, it must be reverted

    const beforeWei = await promisify(web3.eth.getBalance, investor1);

    // If someone transfers wei more than maxCap, revert
    await assertRevert(crowdsale.sendTransaction({from: investor1, value: exceededValue, gasPrice: 0}));

    // If someone transfers wei less than minCapPerPerson, revert
    await assertRevert(crowdsale.sendTransaction({from: investor1, value: tooSmallValue, gasPrice: 0}));

    // If the each value of wei is less than maxCapPerPerson, but total value is exceeded
    await crowdsale.sendTransaction({from: investor1, value: oneMoreTransfer, gasPrice: 0});
    await assertRevert(crowdsale.sendTransaction({from: investor1, value: oneMoreTransfer, gasPrice: 0}));

    // This value don't exceed maxCapPerPerson
    const allowedValue = maxCapPerPerson - oneMoreTransfer;
    await crowdsale.sendTransaction({from: investor1, value: allowedValue, gasPrice: 0});

    const afterWei = await promisify(web3.eth.getBalance, investor1);
    const weiRaised = await crowdsale.weiRaised();
    const purchaseValue = await crowdsale.balances(investor1);

    weiRaised.should.be.bignumber.equal(maxCapPerPerson);
    purchaseValue.should.be.bignumber.equal(maxCapPerPerson);
    afterWei.should.be.bignumber.equal(beforeWei.sub(maxCapPerPerson));
  });

  it('should prevent claiming before finished', async () => {
    const value = 500;

    await crowdsale.sendTransaction({from: investor1, value: value});

    await assertRevert(crowdsale.claim({from: investor1}));

    await genJunkTxs(20);

    await crowdsale.claim({from: investor1});

    const balanceInVault = await crowdsale.balances(investor1);
    const balanceOfInvestor = await token.balanceOf(investor1);

    balanceInVault.should.be.bignumber.equal(0);
    balanceOfInvestor.should.be.bignumber.equal(value * rate);
  });

  it('should be able to distribute tokens after finished by owner', async () => {
    await crowdsale.sendTransaction({from: investor1, value: 300});
    await crowdsale.sendTransaction({from: investor2, value: 600});

    const weiRaised = await crowdsale.weiRaised();

    weiRaised.should.be.bignumber.equal(900);

    await genJunkTxs(20);

    await crowdsale.distribute([investor1, investor2], {from: owner});

    const balance1 = await token.balanceOf(investor1);
    const balance2 = await token.balanceOf(investor2);

    balance1.should.be.bignumber.equal(300 * rate);
    balance2.should.be.bignumber.equal(600 * rate);
  });

  it('should return unsold tokens after endBlockNumber', async () => {
    const unsoldTokenInWei = 800; // unsold token is this value times rate
    const soldTokenInWei = maxCap - unsoldTokenInWei;
    const expectUnsoldToken = unsoldTokenInWei * rate;

    await crowdsale.sendTransaction({from: investor1, value: 300});
    await crowdsale.sendTransaction({from: investor2, value: 700});
    const investors = await virtualTokenSale(soldTokenInWei - 1000);

    await genJunkTxs(20);

    const beforeWeiOfWallet = await promisify(web3.eth.getBalance, wallet);
    await crowdsale.finalize({from: owner});
    const afterWeiOfWallet = await promisify(web3.eth.getBalance, wallet);

    const tokenBalanceOfWallet = await token.balanceOf(wallet);

    afterWeiOfWallet.should.be.bignumber.equal(beforeWeiOfWallet.add(soldTokenInWei));
    tokenBalanceOfWallet.should.be.bignumber.equal(expectUnsoldToken);

    // If finalize before all claiming, they can receive tokens
    await crowdsale.distribute([investor1, investor2, ...investors], {from: owner});

    const balance1 = await token.balanceOf(investor1);
    const balance2 = await token.balanceOf(investor2);

    balance1.should.be.bignumber.equal(300 * rate);
    balance2.should.be.bignumber.equal(700 * rate);

    const balanceOfCrowdsaleContract = await token.balanceOf(crowdsale.address);
    balanceOfCrowdsaleContract.should.be.bignumber.equal(0);
  });
});
