import assertRevert from './helpers/assertRevert';
import promisify from './helpers/promisify';
import toHex from './helpers/toHex';
import ethUtil from 'ethereumjs-util';
import ethAbi from 'ethereumjs-abi';
import sigUtil from 'eth-sig-util';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MuzikaCoin', ([_, owner, recipient, anotherAccount, thirdAccount]) => {
  const initialSupply = 10000;
  let token;

  const MODE_TRANSFER = "Transfer";
  const MODE_APPROVAL = "Approval";
  const MODE_INC_APPROVAL = "IncApprv";
  const MODE_DEC_APPROVAL = "DecApprv";

  let signedTypedDataSchema = [
    "bytes8 Mode",
    "address Token",
    "address To",
    "uint256 Amount",
    "uint256 Fee",
    "uint256 Nonce",
  ];

  let signedTypes = signedTypedDataSchema.map(v => v.split(' ')[0]);
  let schemaTypes = signedTypedDataSchema.map(v => 'string');

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});

    let schemaPrefix = ethAbi.soliditySHA3(schemaTypes, signedTypedDataSchema);

    await token.upgradePrefixPreSignedSecond(3, ethUtil.bufferToHex(schemaPrefix), {from: owner});
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

  describe('transferPreSigned() tests', () => {
    const from = '0x44daf2bb9f91182ec07e99959516287e4bd7db80';
    const fromPrivKey = '0x33745346434c76712ec3029a3b5bcef55f7fd06e83f5be334dbf603624bbbede';
    const fromPrivKeyBuf = Buffer.from(fromPrivKey.slice(2), 'hex');

    const to = recipient;
    const delegate = anotherAccount;
    const initialTransferAmount = 5000;
    const amount = 500;
    const fee = 10;

    const sign = async (_from, _to, _amount, _fee, _nonce) => {
      let message = ethAbi.soliditySHA3(
        ['bytes8', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        [MODE_TRANSFER, token.address, _to, _amount, _fee, _nonce]
      );
      return await promisify(web3.eth.sign, _from, ethUtil.bufferToHex(message));
    };

    beforeEach(async () => {
      // new account has no ether
      await promisify(web3.personal.importRawKey, fromPrivKey, 'password');
      await token.transfer(from, initialTransferAmount, {from: owner});
    });

    it('should support to delegate transferring correctly', async () => {
      // 'from' wants to transfer to 'to' without use ether
      let nonce = await promisify(web3.eth.getTransactionCount, from);

      const currentEther = await promisify(web3.eth.getBalance, from);
      const signature = await sign(from, to, amount, fee, nonce);

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
      const rawSig = ethUtil.ecsign(
        ethAbi.soliditySHA3(
          ['string', 'bytes32'],
          [
            '\x19Ethereum Signed Message:\n\x20',
            ethAbi.soliditySHA3(
              ['bytes8', 'address', 'address', 'uint256', 'uint256', 'uint256'],
              [MODE_TRANSFER, token.address, to, amount, fee, nonce]
            )
          ]
        ),
        fromPrivKeyBuf
      );
      const signature = ethUtil.bufferToHex(sigUtil.concatSig(rawSig.v, rawSig.r, rawSig.s));

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
      const typedData = [
        {type: 'bytes8', name: 'Mode', value: MODE_TRANSFER},
        {type: 'address', name: 'Token', value: token.address},
        {type: 'address', name: 'To', value: to},
        {type: 'uint256', name: 'Amount', value: amount},
        {type: 'uint256', name: 'Fee', value: fee},
        {type: 'uint256', name: 'Nonce', value: nonce},
      ];
      const signature = sigUtil.signTypedData(fromPrivKeyBuf, {data: typedData});

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

      const signature = await sign(from, to, initialTransferAmount - fee, fee, nonce);

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

    it('should protect replay attach', async () => {
      let nonce = await promisify(web3.eth.getTransactionCount, from);

      const signature = await sign(from, to, amount, fee, nonce);

      await token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate});
      await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
    });

    it('should not be transferred when it has invalid parameter', async () => {
      let nonce = await promisify(web3.eth.getTransactionCount, from);
      const signature = await sign(from, to, amount, fee, nonce);

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

      const signature = await sign(delegate, to, amount, fee, nonce);

      await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
    });

    it('should not be transferred when it has balances of \'from\' is over', async () => {
      let nonce = await promisify(web3.eth.getTransactionCount, from);

      // exceeded amount
      const signature = await sign(from, to, initialTransferAmount, fee, nonce);

      // abnormal amount
      await assertRevert(token.transferPreSigned(to, initialTransferAmount, fee, nonce, 1, signature, {from: delegate}));
    });

    it('should not be transferred when overflow', async () => {
      let nonce = await promisify(web3.eth.getTransactionCount, from);

      let amount = '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      let fee = '0x8000000000000000000000000000000000000000000000000000000000000001';
      // amount + fee = 0x7f...fff + 0x800...001 = 0x000...000 in uint256
      const signature = await sign(from, to, amount, fee, nonce);

      // abnormal amount
      await assertRevert(token.transferPreSigned(to, amount, fee, nonce, 1, signature, {from: delegate}));
    });
  });
});
