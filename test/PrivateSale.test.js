import {assertRevert} from './helpers/assertRevert';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const PrivateSale = artifacts.require('PrivateSaleMock');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('PrivateSale', ([_, owner, investor1, investor2, anotherAccount]) => {
  const initialSupply = 10000;
  const rate = 7;

  let token;
  let privateSale;
  let initialReleaseRatio = 20;
  let releaseRatioPerStep = 10;
  let releasedTime;
  let totalStep;
  let daysInterval; // this unit is seconds

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

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});
  });

  describe('fundamental functions testing', () => {
    const deploy = async (releasedTime, initiallySetInvestor) => {
      privateSale = await PrivateSale.new(
        token.address,
        rate,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(privateSale.address, 5000, {from: owner});
      await privateSale.releaseTimeLockup(releasedTime, {from: owner});

      if (initiallySetInvestor) {
        await privateSale.setInvestor(investor1, 30, {from: owner});
      }
    };

    beforeEach(async () => {
      releasedTime = now();
      totalStep = 9;
      daysInterval = 10;
    });

    it('should save correct information', async () => {
      await deploy(releasedTime);

      await privateSale.setInvestor(investor1, 30, {from: owner});
      await privateSale.setInvestor(investor2, 70, {from: owner});

      const weiRaised = await privateSale.weiRaised();
      const raisedByInvestor1 = await privateSale.raisedBy(investor1);
      const raisedByInvestor2 = await privateSale.raisedBy(investor2);
      const balanceOfInvestor1 = await privateSale.balances(investor1);
      const balanceOfInvestor2 = await privateSale.balances(investor2);

      weiRaised.should.be.bignumber.equals(100);
      raisedByInvestor1.should.be.bignumber.equals(30);
      raisedByInvestor2.should.be.bignumber.equals(70);
      balanceOfInvestor1.should.be.bignumber.equals(30);
      balanceOfInvestor2.should.be.bignumber.equals(70);
    });

    it('should save correct information after distributed', async () => {
      await deploy(releasedTime);

      await privateSale.setInvestor(investor1, 30, {from: owner});
      await privateSale.setInvestor(investor2, 70, {from: owner});

      await privateSale.distribute({from: owner});

      const raisedByInvestor1 = await privateSale.raisedBy(investor1);
      const raisedByInvestor2 = await privateSale.raisedBy(investor2);
      const balanceOfInvestor1 = await privateSale.balances(investor1);
      const balanceOfInvestor2 = await privateSale.balances(investor2);

      raisedByInvestor1.should.be.bignumber.equals(30);
      raisedByInvestor2.should.be.bignumber.equals(70);
      balanceOfInvestor1.should.be.bignumber.not.equals(30);
      balanceOfInvestor2.should.be.bignumber.not.equals(70);
    });

    it('should reject when owner sets investor who is already participant', async () => {
      await deploy(releasedTime);

      await privateSale.setInvestor(investor1, 30, {from: owner});
      await assertRevert(privateSale.setInvestor(investor1, 30, {from: owner}));
    });

    it('should have correct the number of investors', async () => {
      await deploy(releasedTime);

      let investorCount = await privateSale.investorCount();
      investorCount.should.be.bignumber.equals(0);

      await privateSale.setInvestor(investor1, 30, {from: owner});
      investorCount = await privateSale.investorCount();
      investorCount.should.be.bignumber.equals(1);

      await privateSale.setInvestor(investor2, 30, {from: owner});
      investorCount = await privateSale.investorCount();
      investorCount.should.be.bignumber.equals(2);
    });

    it('should not distribute nor claim before start', async () => {
      releasedTime = now() + 10 * 60; // 10 minutes
      await deploy(releasedTime, true);

      await assertRevert(privateSale.claim({from: investor1}));
      await assertRevert(privateSale.claimFor(investor1, {from: owner}));
      await assertRevert(privateSale.distribute({from: owner}));
    });

    it('waits for being released', async () => {
      let investAmount = 30;
      let remainBalance = investAmount;
      releasedTime = now() + 5; // 5s
      await deploy(releasedTime, true);

      /* Before released */
      await assertRevert(privateSale.distribute({from: owner}));

      /* After released */
      await wait(5000);
      await privateSale.distribute({from: owner});
      let expectedBalance = remainBalance - percentOf(investAmount, initialReleaseRatio);
      let actualBalance = await privateSale.balances(investor1);
      remainBalance -= percentOf(investAmount, initialReleaseRatio);

      actualBalance.should.be.bignumber.equals(expectedBalance);

      /* Reject distribute in step 2: Not released */
      await assertRevert(privateSale.distribute({from: owner}));

      /* Reject distribute in step 2: Released */
      await wait(daysInterval * 1000);
      await privateSale.distribute({from: owner});
      expectedBalance = remainBalance - percentOf(investAmount, releaseRatioPerStep);
      actualBalance = await privateSale.balances(investor1);

      actualBalance.should.be.bignumber.equals(expectedBalance);
    });
  });

  describe('investment testing', () => {
    const investors = [investor1, investor2];
    const purchases = [35, 73];
    const expectedTotalTokens = purchases.map(amount => amount * rate);

    beforeEach(async () => {
      releasedTime = now();
      totalStep = 2;
      initialReleaseRatio = 40;
      releaseRatioPerStep = 30;
      daysInterval = 5; // 5 seconds

      privateSale = await PrivateSale.new(
        token.address,
        rate,
        initialReleaseRatio,
        releaseRatioPerStep,
        totalStep,
        daysInterval,
        {from: owner}
      );
      await token.transfer(privateSale.address, 5000, {from: owner});
      await privateSale.releaseTimeLockup(releasedTime, {from: owner});

      for (let i = 0; i < investors.length; i++) {
        await privateSale.setInvestor(investors[i], purchases[i], {from: owner});
      }
    });

    it('should be successfully distributed', async () => {
      // First step, each user should receive tokens that is 40% of total
      await privateSale.distribute({from: owner});
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
      await privateSale.distribute({from: owner});
      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];
        const purchase = purchases[i];

        const expectedAmount = percentOf(purchase, releaseRatioPerStep) * rate;
        const actualAmount = await token.balanceOf(investor);

        actualAmount.should.be.bignumber.equals(currentTokenBalances[i] + expectedAmount);
        currentTokenBalances[i] += expectedAmount;
      }

      await wait(daysInterval * 1000);
      // Third step, each is 20%
      await privateSale.distribute({from: owner});

      // Successfully distribute all tokens
      const balanceOfInvestor1 = await privateSale.balances(investor1);
      const balanceOfInvestor2 = await privateSale.balances(investor2);

      balanceOfInvestor1.should.be.bignumber.equals(0);
      balanceOfInvestor2.should.be.bignumber.equals(0);

      for (let i = 0; i < investors.length; i++) {
        const investor = investors[i];

        const expectedAmount = expectedTotalTokens[i];
        const actualAmount = await token.balanceOf(investor);

        actualAmount.should.be.bignumber.equals(expectedAmount);
      }
    });
  });
});
