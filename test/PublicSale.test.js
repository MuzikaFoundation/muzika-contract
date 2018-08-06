import {assertRevert} from './helpers/assertRevert';
import {promisify} from './helpers/promisify';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const PublicSale = artifacts.require('PublicSaleMock');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('PublicSale', ([_, owner, wallet, investor1, investor2]) => {
  const initialSupply = 100000;
  const rate = 7;
  const maxCap = 5000;
  const minCapPerPerson = 30;
  const maxCapPerPerson = 1000;

  let token;
  let publicSale;
  let saleStartTime;
  let saleEndTime;
  let initialReleaseRatio = 20;
  let releaseRatioPerStep = 10;
  let totalStep;
  let daysInterval; // this unit is seconds

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
   * Wait for milliseconds
   *
   * @param milliseconds
   * @returns {Promise}
   */
  const wait = (milliseconds) => {
    return new Promise(resolve => {
      setTimeout(() => resolve(), milliseconds)
    });
  };

  /**
   * Current timestamp in seconds
   *
   * @returns {number}
   */
  const now = () => Math.floor(new Date().getTime() / 1000);

  /**
   * Calculate what is `percent` of `value`
   *
   * @param value
   * @param percent
   * @returns {number}
   */
  const percentOf = (value, percent) => Math.floor(value * percent / 100);

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
      await publicSale.buyToken('0x' + address.toString('hex'), {from: _, value: value, gasPrice: 0});
      amount -= value;
      addresses.push('0x' + address.toString('hex'));
    }

    return addresses;
  };

  /**
   * Get balance in ether
   *
   * @param address
   */
  const getBalance = (address) => promisify(web3.eth.getBalance, address);

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});
  });

  describe('basic testing', () => {
    const deploy = async (startTime, endTime) => {
      saleStartTime = startTime;
      saleEndTime = !endTime ? saleStartTime + 5 : endTime;

      publicSale = await PublicSale.new(
        token.address,
        wallet,
        rate,
        minCapPerPerson,
        maxCapPerPerson,
        maxCap,
        saleStartTime,
        saleEndTime,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(publicSale.address, maxCap * rate, {from: owner});
    };

    beforeEach(async () => {
      totalStep = 8;
      daysInterval = 5;
    });

    it('should be sold in sale period', async () => {
      await deploy(now() + 5);

      const value = 500;
      await assertRevert(publicSale.sendTransaction({from: investor1, value: value}));

      // start to sale
      await wait(5000);

      const beforePurchase = await getBalance(investor1);
      await publicSale.sendTransaction({from: investor1, value: value, gasPrice: 0});
      const afterPurchase = await getBalance(investor1);

      const purchaseValue = await publicSale.balances(investor1);
      const weiRaised = await publicSale.weiRaised();

      purchaseValue.should.be.bignumber.equal(value);
      weiRaised.should.be.bignumber.equal(value);
      afterPurchase.should.be.bignumber.equal(beforePurchase.sub(value));

      // stop sale
      await wait(5000);

      await assertRevert(publicSale.sendTransaction({from: investor2, value: value}));
    });

    it('should save correct information', async () => {
      await deploy(now());

      await publicSale.sendTransaction({from: investor1, value: 30, gasPrice: 0});
      await publicSale.sendTransaction({from: investor2, value: 70, gasPrice: 0});

      const weiRaised = await publicSale.weiRaised();
      const raisedByInvestor1 = await publicSale.raisedBy(investor1);
      const raisedByInvestor2 = await publicSale.raisedBy(investor2);
      const balanceOfInvestor1 = await publicSale.balances(investor1);
      const balanceOfInvestor2 = await publicSale.balances(investor2);

      weiRaised.should.be.bignumber.equals(100);
      raisedByInvestor1.should.be.bignumber.equals(30);
      raisedByInvestor2.should.be.bignumber.equals(70);
      balanceOfInvestor1.should.be.bignumber.equals(30);
      balanceOfInvestor2.should.be.bignumber.equals(70);
    });

    it('should save correct information after distributed', async () => {
      await deploy(now());

      await publicSale.sendTransaction({from: investor1, value: 30, gasPrice: 0});
      await publicSale.sendTransaction({from: investor2, value: 70, gasPrice: 0});

      await wait(5000);

      await publicSale.claim({from: investor1});
      await publicSale.claim({from: investor2});

      const raisedByInvestor1 = await publicSale.raisedBy(investor1);
      const raisedByInvestor2 = await publicSale.raisedBy(investor2);
      const balanceOfInvestor1 = await publicSale.balances(investor1);
      const balanceOfInvestor2 = await publicSale.balances(investor2);

      raisedByInvestor1.should.be.bignumber.equals(30);
      raisedByInvestor2.should.be.bignumber.equals(70);
      balanceOfInvestor1.should.be.bignumber.not.equals(30);
      balanceOfInvestor2.should.be.bignumber.not.equals(70);
    });

    it('should not distribute nor claim before start', async () => {
      await deploy(now(), now() + 10 * 60);

      await publicSale.sendTransaction({from: investor1, value: 30, gasPrice: 0});

      await assertRevert(publicSale.claim({from: investor1}));
      await assertRevert(publicSale.claimFor(investor1, {from: owner}));
      await assertRevert(publicSale.distribute([investor1], {from: owner}));
    });

    it('waits for being released', async () => {
      let investAmount = 30;
      let remainBalance = investAmount;
      await deploy(now());

      await publicSale.sendTransaction({from: investor1, value: investAmount, gasPrice: 0});

      /* Before released */
      await assertRevert(publicSale.claim({from: investor1}));

      /* After sale Finished */
      await wait(5000);
      await publicSale.claim({from: investor1});
      let expectedBalance = remainBalance - percentOf(investAmount, initialReleaseRatio);
      let actualBalance = await publicSale.balances(investor1);
      remainBalance -= percentOf(investAmount, initialReleaseRatio);

      actualBalance.should.be.bignumber.equals(expectedBalance);

      /* Reject claiming in step 2: Not released */
      await assertRevert(publicSale.claim({from: investor1}));

      /* Reject distribute in step 2: Released */
      await wait(daysInterval * 1000);
      await publicSale.claim({from: investor1});
      expectedBalance = remainBalance - percentOf(investAmount, releaseRatioPerStep);
      actualBalance = await publicSale.balances(investor1);

      actualBalance.should.be.bignumber.equals(expectedBalance);
    });
  });

  describe('edge case testing', () => {
    beforeEach(async () => {
      saleStartTime = now();
      saleEndTime = saleStartTime + 10;
      totalStep = 8;
      daysInterval = 5;

      publicSale = await PublicSale.new(
        token.address,
        wallet,
        rate,
        minCapPerPerson,
        maxCapPerPerson,
        maxCap,
        saleStartTime,
        saleEndTime,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(publicSale.address, maxCap * rate, {from: owner});
    });

    it('should refund when transferred value exceed maximum cap', async () => {
      const remainValue = 222;
      const transferValue = 737;

      await virtualTokenSale(maxCap - remainValue);

      const beforeWei = await getBalance(investor1);
      await publicSale.sendTransaction({from: investor1, value: transferValue, gasPrice: 0});
      const afterWei = await getBalance(investor1);

      const weiRaised = await publicSale.weiRaised();
      const purchaseValue = await publicSale.balances(investor1);

      weiRaised.should.be.bignumber.equal(maxCap);
      purchaseValue.should.be.bignumber.equal(remainValue);
      afterWei.should.be.bignumber.equal(beforeWei.sub(remainValue));
    });

    it('should revert when maximum capability per person is exceeded', async () => {
      const tooSmallValue = minCapPerPerson - 10;
      const exceededValue = maxCapPerPerson + 100;
      const oneMoreTransfer = maxCapPerPerson / 2 + 100; // if someone transfers to contract two or more times, it must be reverted

      const beforeWei = await getBalance(investor1);

      // If someone transfers wei more than maxCap, revert
      await assertRevert(publicSale.sendTransaction({from: investor1, value: exceededValue, gasPrice: 0}));

      // If someone transfers wei less than minCapPerPerson, revert
      await assertRevert(publicSale.sendTransaction({from: investor1, value: tooSmallValue, gasPrice: 0}));

      // If the each value of wei is less than maxCapPerPerson, but total value is exceeded
      await publicSale.sendTransaction({from: investor1, value: oneMoreTransfer, gasPrice: 0});
      await assertRevert(publicSale.sendTransaction({from: investor1, value: oneMoreTransfer, gasPrice: 0}));

      // This value don't exceed maxCapPerPerson
      const allowedValue = maxCapPerPerson - oneMoreTransfer;
      await publicSale.sendTransaction({from: investor1, value: allowedValue, gasPrice: 0});

      const afterWei = await getBalance(investor1);
      const weiRaised = await publicSale.weiRaised();
      const purchaseValue = await publicSale.balances(investor1);

      weiRaised.should.be.bignumber.equal(maxCapPerPerson);
      purchaseValue.should.be.bignumber.equal(maxCapPerPerson);
      afterWei.should.be.bignumber.equal(beforeWei.sub(maxCapPerPerson));
    });
  });

  describe('token sale testing', () => {
    const investors = [investor1, investor2];
    const purchases = [35, 73];
    const expectedTotalTokens = purchases.map(amount => amount * rate);

    beforeEach(async () => {
      saleStartTime = now();
      saleEndTime = saleStartTime + 5;
      totalStep = 2;
      initialReleaseRatio = 40;
      releaseRatioPerStep = 30;
      daysInterval = 5; // 5 seconds

      publicSale = await PublicSale.new(
        token.address,
        wallet,
        rate,
        minCapPerPerson,
        maxCapPerPerson,
        maxCap,
        saleStartTime,
        saleEndTime,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(publicSale.address, maxCap * rate, {from: owner});

      for (let i = 0; i < investors.length; i++) {
        await publicSale.sendTransaction({from: investors[i], value: purchases[i], gasPrice: 0});
      }

      // token sale is finished
      await wait(5000);
    });

    it('should be successfully distributed', async () => {
      // First step, each user should receive tokens that is 40% of total
      await publicSale.distribute(investors, {from: owner});
      const currentTokenBalances = investors.map(() => 0);

      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];
        const purchase = purchases[i];

        const expectedAmount = percentOf(purchase, initialReleaseRatio) * rate;
        const actualAmount = await token.balanceOf(investor);

        actualAmount.should.be.bignumber.equals(expectedAmount);
        currentTokenBalances[i] += expectedAmount;
      }

      await wait(daysInterval * 1000);

      // Second step, each is 20%
      // also test for claim function
      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];
        const purchase = purchases[i];

        await publicSale.claim({from: investor});
        const expectedAmount = percentOf(purchase, releaseRatioPerStep) * rate;
        const actualAmount = await token.balanceOf(investor);

        actualAmount.should.be.bignumber.equals(currentTokenBalances[i] + expectedAmount);
        currentTokenBalances[i] += expectedAmount;
      }

      await wait(daysInterval * 1000);
      // Third step, each is 20%

      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];

        await publicSale.claimFor(investor, {from: owner});

        // Successfully distribute all tokens
        const balanceOfInvestor = await publicSale.balances(investor);

        balanceOfInvestor.should.be.bignumber.equals(0);

        const expectedAmount = expectedTotalTokens[i];
        const actualAmount = await token.balanceOf(investor);

        actualAmount.should.be.bignumber.equals(expectedAmount);
      }
    });
  });

  describe('after token sale', () => {
    beforeEach(async () => {
      saleStartTime = now();
      saleEndTime = saleStartTime + 10;
      totalStep = 0;
      initialReleaseRatio = 100;
      daysInterval = 5; // 5 seconds

      publicSale = await PublicSale.new(
        token.address,
        wallet,
        rate,
        minCapPerPerson,
        maxCapPerPerson,
        maxCap,
        saleStartTime,
        saleEndTime,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(publicSale.address, maxCap * rate, {from: owner});
    });

    it('should return unsold tokens after public sale', async () => {
      const unsoldTokenInWei = 800; // unsold token is this value times rate
      const soldTokenInWei = maxCap - unsoldTokenInWei;
      const expectUnsoldToken = unsoldTokenInWei * rate;

      await publicSale.sendTransaction({from: investor1, value: 300});
      await publicSale.sendTransaction({from: investor2, value: 700});
      const investors = await virtualTokenSale(soldTokenInWei - 1000);

      // Wait for being finished
      await wait((saleEndTime - now()) * 1000);

      const beforeWeiOfWallet = await getBalance(wallet);
      await publicSale.finalize({from: owner});
      const afterWeiOfWallet = await getBalance(wallet);

      const tokenBalanceOfWallet = await token.balanceOf(wallet);

      afterWeiOfWallet.should.be.bignumber.equal(beforeWeiOfWallet.add(soldTokenInWei));
      tokenBalanceOfWallet.should.be.bignumber.equal(expectUnsoldToken);

      // If finalize before all claiming, they can receive tokens
      await publicSale.distribute([investor1, investor2, ...investors], {from: owner});

      const balance1 = await token.balanceOf(investor1);
      const balance2 = await token.balanceOf(investor2);

      balance1.should.be.bignumber.equal(300 * rate);
      balance2.should.be.bignumber.equal(700 * rate);

      const tokenBalanceOfCrowdsaleContract = await token.balanceOf(publicSale.address);
      const balanceOfCrowdsaleContract = await token.balanceOf(publicSale.address);
      tokenBalanceOfCrowdsaleContract.should.be.bignumber.equal(0);
      balanceOfCrowdsaleContract.should.be.bignumber.equal(0);
    });
  })
});
