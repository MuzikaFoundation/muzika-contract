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

  it('should be able to freeze account', async () => {
    let isFrozen = await token.frozenAddress(recipient);
    isFrozen.should.be.equal(false, 'Recipient should be unfrozen');

    await token.freezeAddress(recipient, {from: owner});

    isFrozen = await token.frozenAddress(recipient);
    isFrozen.should.be.equal(true, 'Recipient should be frozen');

    await token.unfreezeAddress(recipient, {from: owner});

    isFrozen = await token.frozenAddress(recipient);
    isFrozen.should.be.equal(false, 'Recipient should be unfrozen');
  });

  it('disallows frozen address to transfer', async () => {
    await token.transfer(recipient, 100, {from: owner});
    await token.freezeAddress(recipient, {from: owner});

    await assertRevert(token.transfer(owner, 50, {from: recipient}));

    const balance = await token.balanceOf(recipient);
    balance.should.be.bignumber.equal(100);
  });

  it('allows to transfer from address to another address', async () => {
    const amount = 100;

    await token.transfer(recipient, amount, {from: owner});
    await token.approve(thirdAccount, 5000, {from: recipient});

    await token.transferFrom(recipient, anotherAccount, amount, {from: thirdAccount});

    const balance = await token.balanceOf(anotherAccount);

    balance.should.be.bignumber.equal(amount);
  });

  it('disallows to transfer from blocked address to another address', async () => {
    await token.transfer(recipient, 100, {from: owner});
    await token.approve(thirdAccount, 5000, {from: recipient});

    await token.freezeAddress(recipient, {from: owner});

    await assertRevert(token.transferFrom(recipient, anotherAccount, 50, {from: thirdAccount}));
  });

  it('disallows blocked and approved account to transfer from address to another address', async () => {
    await token.transfer(recipient, 100, {from: owner});
    await token.approve(thirdAccount, 5000, {from: recipient});

    await token.freezeAddress(thirdAccount, {from: owner});

    await assertRevert(token.transferFrom(recipient, anotherAccount, 50, {from: thirdAccount}));
  });

  describe('preSignedFunctions', () => {
    const from = '0x44daf2bb9f91182ec07e99959516287e4bd7db80';
    const fromPrivateKey = '0x33745346434c76712ec3029a3b5bcef55f7fd06e83f5be334dbf603624bbbede';

    let to = recipient;
    let delegate = anotherAccount;
    let initialTransferAmount = 5000;
    let amount = 500;
    let fee = 10;

    beforeEach(async () => {
      // new account has no ether
      await promisify(web3.personal.importRawKey, fromPrivateKey, 'password');
      await token.transfer(from, initialTransferAmount, {from: owner});

      to = recipient;
      delegate = anotherAccount;
      initialTransferAmount = 5000;
      amount = 500;
      fee = 10;
    });

    // sign functions
    let sign, trezorSign, signTypedData;

    describe('transferPreSigned()', () => {
      beforeEach(() => {
        sign = signToken.bind(null, token.address, from, MODE_TRANSFER);
        trezorSign = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_TRANSFER);
        signTypedData = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_TRANSFER);
      });

      it('should support to delegate transferring correctly', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await sign(to, amount, fee, nonce);

        // another account send the transaction
        await token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        const balanceOfFrom = await token.balanceOf(from);
        const balanceOfTo = await token.balanceOf(to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        balanceOfFrom.should.be.bignumber.equal(initialTransferAmount - amount - fee);
        balanceOfTo.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate transferring correctly using Trezor', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await trezorSign(to, amount, fee, nonce);

        // another account send the transaction
        await token.transferPreSigned(to, amount, fee, nonce, 2, signature, {from: delegate});

        const balanceOfFrom = await token.balanceOf(from);
        const balanceOfTo = await token.balanceOf(to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        balanceOfFrom.should.be.bignumber.equal(initialTransferAmount - amount - fee);
        balanceOfTo.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate transferring correctly using signTypedData', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await signTypedData(to, amount, fee, nonce);

        // another account send the transaction
        await token.transferPreSigned(to, amount, fee, nonce, 3, signature, {from: delegate});

        const balanceOfFrom = await token.balanceOf(from);
        const balanceOfTo = await token.balanceOf(to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        balanceOfFrom.should.be.bignumber.equal(initialTransferAmount - amount - fee);
        balanceOfTo.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('is successfully transferred with boundary value', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(to, initialTransferAmount - fee, fee, nonce);

        // abnormal amount
        await token.transferPreSigned(to, initialTransferAmount - fee, fee, nonce, 1, signature, {from: delegate});

        const balanceOfFrom = await token.balanceOf(from);
        const balanceOfTo = await token.balanceOf(to);
        const balanceOfDelegate = await token.balanceOf(delegate);

        balanceOfFrom.should.be.bignumber.equal(0);
        balanceOfTo.should.be.bignumber.equal(initialTransferAmount - fee);
        balanceOfDelegate.should.be.bignumber.equal(fee);
      });

      // it('should not be transferred when it has invalid nonce', async () => {
      //   const abnormalNonce = nonce + 2;
      //   const signature = await sign(from, to, amount, fee, abnormalNonce);
      //
      //   await assertRevert(token.delegateTransfer(from, to, amount, fee, signature, {from: delegate}));
      // });

      it('should protect replay attack', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(to, amount, fee, nonce);

        await token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});
        await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be transferred when it has invalid parameter', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        const signature = await sign(to, amount, fee, nonce);

        // abnormal amount
        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.transferPreSigned(to, 600, fee, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.transferPreSigned(to, amount, 50, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.transferPreSigned(owner, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be transferred when it has invalid signature', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(owner, amount, fee, nonce);

        await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be transferred when it has balances of \'from\' is over', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        // exceeded amount
        const signature = await sign(to, initialTransferAmount, fee, nonce);

        // abnormal amount
        await assertRevert(token.transferPreSigned(to, initialTransferAmount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be transferred when overflow', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        let amount = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let fee = '0x8000000000000000000000000000000000000000000000000000000000000001';
        // amount + fee = 0x7f...fff + 0x800...001 = 0x000...000 in uint256
        const signature = await sign(to, amount, fee, nonce);

        // abnormal amount
        await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });
    });

    describe('approvePreSigned()', () => {
      beforeEach(() => {
        sign = signToken.bind(null, token.address, from, MODE_APPROVAL);
        trezorSign = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);
        signTypedData = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);
      });

      it('should support to delegate approving correctly', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await sign(to, amount, fee, nonce);

        // another account send the transaction
        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate approving correctly using Trezor', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await trezorSign(to, amount, fee, nonce);

        // another account send the transaction
        await token.approvePreSigned(to, amount, fee, nonce, 2, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate approving correctly using signTypedData', async () => {
        // 'from' wants to transfer to 'to' without use ether
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const currentEther = await promisify(web3.eth.getBalance, from);
        const signature = await signTypedData(to, amount, fee, nonce);

        // another account send the transaction
        await token.approvePreSigned(to, amount, fee, nonce, 3, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount);
        balanceOfDelegate.should.be.bignumber.equal(fee);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should protect replay attack', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(to, amount, fee, nonce);

        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});
        await assertRevert(token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid parameter', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        const signature = await sign(to, amount, fee, nonce);

        // abnormal amount
        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.approvePreSigned(to, 600, fee, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.approvePreSigned(to, amount, 50, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.approvePreSigned(owner, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid signature', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(delegate, amount, fee, nonce);

        await assertRevert(token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });
    });

    describe('increaseApprovalPreSigned()', () => {
      let signApproval, trezorSignApproval, signTypedDataApproval;
      let incAmount = 100;

      beforeEach(() => {
        sign = signToken.bind(null, token.address, from, MODE_INC_APPROVAL);
        trezorSign = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_INC_APPROVAL);
        signTypedData = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_INC_APPROVAL);

        signApproval = signToken.bind(null, token.address, from, MODE_APPROVAL);
        trezorSignApproval = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);
        signTypedDataApproval = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);

        incAmount = 100;
      });

      it('should support to delegate increasing approval correctly', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await signApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await sign(to, incAmount, fee, nonce);
        await token.increaseApprovalPreSigned(to, incAmount, fee, nonce, 1, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount + incAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate increasing approval correctly using Trezor', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await trezorSignApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 2, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await trezorSign(to, incAmount, fee, nonce);
        await token.increaseApprovalPreSigned(to, incAmount, fee, nonce, 2, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount + incAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate increasing approval correctly using signTypedData', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await signTypedDataApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 3, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await signTypedData(to, incAmount, fee, nonce);
        await token.increaseApprovalPreSigned(to, incAmount, fee, nonce, 3, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount + incAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should protect replay attack', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(to, amount, fee, nonce);

        await token.increaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});
        await assertRevert(token.increaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid parameter', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        const signature = await sign(to, amount, fee, nonce);

        // abnormal amount
        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.increaseApprovalPreSigned(to, 600, fee, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.increaseApprovalPreSigned(to, amount, 50, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.increaseApprovalPreSigned(owner, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid signature', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(delegate, amount, fee, nonce);

        await assertRevert(token.increaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when overflow', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let amount = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let incAmount = '0x8000000000000000000000000000000000000000000000000000000000000001';

        let signature = await signApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await sign(to, incAmount, fee, nonce);

        // abnormal amount
        await assertRevert(token.increaseApprovalPreSigned(to, incAmount, fee, nonce, 1, signature, {from: delegate}));
      });
    });

    describe('decreaseApprovalPreSigned()', () => {
      let signApproval, trezorSignApproval, signTypedDataApproval;
      let decAmount = 100;

      beforeEach(() => {
        sign = signToken.bind(null, token.address, from, MODE_DEC_APPROVAL);
        trezorSign = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_DEC_APPROVAL);
        signTypedData = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_DEC_APPROVAL);

        signApproval = signToken.bind(null, token.address, from, MODE_APPROVAL);
        trezorSignApproval = trezorSignToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);
        signTypedDataApproval = signTypedDataToken.bind(null, token.address, fromPrivateKey, MODE_APPROVAL);

        decAmount = 100;
      });

      it('should support to delegate decreasing approval correctly', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await signApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await sign(to, decAmount, fee, nonce);
        await token.decreaseApprovalPreSigned(to, decAmount, fee, nonce, 1, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount - decAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate decreasing approval correctly using Trezor', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await trezorSignApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 2, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await trezorSign(to, decAmount, fee, nonce);
        await token.decreaseApprovalPreSigned(to, decAmount, fee, nonce, 2, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount - decAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should support to delegate decreasing approval correctly using signTypedData', async () => {
        const currentEther = await promisify(web3.eth.getBalance, from);

        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let signature = await signTypedDataApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 3, signature, {from: delegate});

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await signTypedData(to, decAmount, fee, nonce);
        await token.decreaseApprovalPreSigned(to, decAmount, fee, nonce, 3, signature, {from: delegate});

        const allowance = await token.allowance(from, to);
        const balanceOfDelegate = await token.balanceOf(delegate);
        const etherOfFrom = await promisify(web3.eth.getBalance, from);

        allowance.should.be.bignumber.equal(amount - decAmount);
        balanceOfDelegate.should.be.bignumber.equal(fee * 2);
        etherOfFrom.should.be.bignumber.equal(currentEther);
      });

      it('should protect replay attack', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(to, amount, fee, nonce);

        await token.decreaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});
        await assertRevert(token.decreaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid parameter', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        const signature = await sign(to, amount, fee, nonce);

        // abnormal amount
        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.decreaseApprovalPreSigned(to, 600, fee, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.decreaseApprovalPreSigned(to, amount, 50, nonce, 1, signature, {from: delegate}));

        nonce = await promisify(web3.eth.getTransactionCount, from);
        await assertRevert(token.decreaseApprovalPreSigned(owner, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should not be approved when it has invalid signature', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);

        const signature = await sign(delegate, amount, fee, nonce);

        await assertRevert(token.decreaseApprovalPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
      });

      it('should allow to decrease over remaining approval', async () => {
        let nonce = await promisify(web3.eth.getTransactionCount, from);
        let amount = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        let decAmount = '0x8000000000000000000000000000000000000000000000000000000000000001';

        let signature = await signApproval(to, amount, fee, nonce);
        await token.approvePreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});

        let allowance = await token.allowance(from, to);
        allowance.should.be.bignumber.equal(amount);

        nonce = await promisify(web3.eth.getTransactionCount, from);
        signature = await sign(to, decAmount, fee, nonce);

        // abnormal amount
        await token.decreaseApprovalPreSigned(to, decAmount, fee, nonce, 1, signature, {from: delegate});

        allowance = await token.allowance(from, to);
        allowance.should.be.bignumber.equal(0);
      });
    });
  });
});
