import {assertRevert} from './helpers/assertRevert';
import {promisify} from './helpers/promisify';
import {
  MODE_APPROVAL, MODE_DEC_APPROVAL,
  MODE_INC_APPROVAL,
  MODE_TRANSFER,
  signToken,
  signTypedDataToken,
  trezorSignToken
} from './helpers/sign';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MuzikaCoin', ([_, owner, recipient, anotherAccount, thirdAccount]) => {
  const initialSupply = 10000;
  let token;

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});
  });

  it('should be same with initial supply', async () => {
    const totalSupply = await token.totalSupply();

    totalSupply.should.be.bignumber.equal(initialSupply);
  });

  it('should be burned only for owner', async () => {
    const burnAmount = 500;
    await token.transfer(recipient, burnAmount, {from: owner});

    await assertRevert(token.burn(burnAmount, {from: recipient}));
  });

  it('should be transferred', async () => {
    const transferAmount = 500;
    await token.transfer(recipient, transferAmount, {from: owner});

    const balance = await token.balanceOf(recipient);
    balance.should.be.bignumber.equal(transferAmount);
  });

  it('should not be transferred when paused', async () => {
    const paused = await token.paused();

    paused.should.be.equal(false, 'It must be not paused');

    await token.pause({from: owner});

    await assertRevert(token.transfer(recipient, 100, {from: owner}));
    await assertRevert(token.transfer(owner, 10, {from: recipient}));
  });

  it('allows to transfer from address to another address', async () => {
    const amount = 100;

    await token.transfer(recipient, amount, {from: owner});
    await token.approve(thirdAccount, 5000, {from: recipient});

    await token.transferFrom(recipient, anotherAccount, amount, {from: thirdAccount});

    const balance = await token.balanceOf(anotherAccount);

    balance.should.be.bignumber.equal(amount);
  });

  it('should be drained token when it has', async () => {
    await token.transfer(token.address, 100, {from: owner});
    let balanceOfToken = await token.balanceOf(token.address);
    balanceOfToken.should.be.bignumber.equal(100);

    await token.tokenDrain(token.address, 100, {from: owner});
    balanceOfToken = await token.balanceOf(token.address);
    balanceOfToken.should.be.bignumber.equal(0);
  });
});
