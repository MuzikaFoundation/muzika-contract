import {promisify} from './helpers/promisify';
import {assertRevert} from './helpers/assertRevert';
import {inLogs, inTransaction} from './helpers/expectEvent';
import {extractEvent} from './helpers/extractEvent';
import {MODE_INC_APPROVAL, signToken} from './helpers/sign';
import ethAbi from 'ethereumjs-abi';
import ethUtil from 'ethereumjs-util';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');
const PreSignedContract = artifacts.require('PreSignedContract');
const LibPaperPayment = artifacts.require('LibPaperPayment');
const Dispatcher = artifacts.require('Dispatcher');
const DispatcherStorage = artifacts.require('DispatcherStorage');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MuzikaPaperContract', ([_, owner, seller, buyer, anotherAccount]) => {
  const initialSupply = 10000;
  let token;
  let paper;

  const ipfsFileHash = 'QmNbs8stghYQMSTiC28aonneZHAk2dTJmMehJLJWR3xY7u';
  const originalFileHash = 'bea69d582a37712a0e70be4683c682ad9eaefb3078d59d1b222524cff6ef7b17';
  const price = 500;

  // sign function
  let sign = null;

  let backedUpPaperContractBinary = MuzikaPaperContract.bytecode;
  let backedUpLibPaperPaymentBinary = LibPaperPayment.bytecode;

  afterEach(() => {
    // Restore bytecode of paper contract
    MuzikaPaperContract.bytecode = backedUpPaperContractBinary;
    LibPaperPayment.bytecode = backedUpLibPaperPaymentBinary;
  });

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});

    /* Manually replace address of PreSignedContract in compile stage
     * So, you should not be input to the constructor on contracts
     */
    LibPaperPayment.bytecode = LibPaperPayment.bytecode
      .replace('1111222233334444555566667777888899990000', PreSignedContract.address.slice(2))
      .replace('9999888877776666555544443333222211110000', token.address.slice(2));

    const lib = await LibPaperPayment.new({from: owner});
    const dispatcherStorage = await DispatcherStorage.deployed();

    MuzikaPaperContract.link('LibPaperPaymentInterface', Dispatcher.address);

    // Proxy library
    await dispatcherStorage.replace(lib.address, {from: _});

    paper = await MuzikaPaperContract.new(
      seller,
      price,
      ipfsFileHash,
      originalFileHash,
      {from: seller}
    );

    await token.transfer(buyer, 5000, {from: owner});
    sign = signToken.bind(null, token.address, buyer, MODE_INC_APPROVAL);
  });

  /*
  it('works for purchase by PreSigned function (version 1 of purchase)', async () => {
    let nonce = await promisify(web3.eth.getTransactionCount, buyer);
    let signature = await sign(paper.address, price, 0, nonce);

    const beforePurchase = await token.balanceOf(buyer);

    // await token.increaseApproval(paper.address, price, {from: buyer});
    await paper.purchasePreSigned(nonce, 1, signature);

    const afterPurchase = await token.balanceOf(buyer);
    const isPurchased = await paper.isPurchased(buyer);
    const balanceOfSeller = await token.balanceOf(seller);

    afterPurchase.should.be.bignumber.not.equal(beforePurchase);
    isPurchased.should.be.equal(true);
    balanceOfSeller.should.be.bignumber.not.equal(0);
  });

  it('works for purchase by increase approval with PreSigned function (version 2 of purchase)', async () => {
    let nonce = await promisify(web3.eth.getTransactionCount, buyer);
    let signature = await sign(paper.address, price, 0, nonce);

    const beforePurchase = await token.balanceOf(buyer);

    // await token.increaseApproval(paper.address, price, {from: buyer});
    const callData = ethUtil.bufferToHex(ethAbi.simpleEncode('purchase(address)', buyer));
    await token.increaseApprovalPreSignedAndCall(paper.address, price, 0, nonce, 1, signature, callData, {from: buyer});

    const afterPurchase = await token.balanceOf(buyer);
    const isPurchased = await paper.isPurchased(buyer);
    const balanceOfSeller = await token.balanceOf(seller);

    afterPurchase.should.be.bignumber.not.equal(beforePurchase);
    isPurchased.should.be.equal(true);
    balanceOfSeller.should.be.bignumber.not.equal(0);
  });
  */
  it('should be equal to information', async () => {
    const savedSeller = await paper.seller();
    const savedPrice = await paper.price();
    const savedIPFSHash = await paper.ipfsFileHash({from: seller});
    const savedOriginalHash = await paper.originalFileHash();

    savedSeller.should.be.equal(seller);
    savedPrice.should.be.bignumber.equal(price);
    savedIPFSHash.should.be.equal(ipfsFileHash);
    savedOriginalHash.should.be.equal(originalFileHash);
  });

  it('works for purchase by increase approval without PreSigned function (version 3 of purchase)', async () => {
    const beforePurchase = await token.balanceOf(buyer);

    // await token.increaseApproval(paper.address, price, {from: buyer});
    // const callData = ethUtil.bufferToHex(ethAbi.simpleEncode('purchase(address)', buyer));
    await token.increaseApprovalAndCall(paper.address, price, '0x', {from: buyer});

    const afterPurchase = await token.balanceOf(buyer);
    const isPurchased = await paper.isPurchased(buyer);
    const balanceOfSeller = await token.balanceOf(seller);

    const event = await inLogs(await extractEvent(paper), 'Purchase');

    afterPurchase.should.be.bignumber.not.equal(beforePurchase);
    isPurchased.should.be.equal(true);
    balanceOfSeller.should.be.bignumber.not.equal(0);
    event.args.buyer.should.be.equal(buyer);
    event.args.price.should.be.bignumber.equal(price);
  });

  it('should be stop sale when sold out', async () => {
    await inTransaction(paper.soldOut({from: seller}), 'SoldOut');

    const forSale = await paper.forSale();

    forSale.should.be.equal(false);
    await assertRevert(token.increaseApprovalAndCall(paper.address, price, '0x', {from: buyer}))
  });

  it('should be able to resale product', async () => {
    await paper.soldOut({from: seller});
    await inTransaction(paper.resale({from: seller}), 'Resale');

    const forSale = await paper.forSale();
    await token.increaseApprovalAndCall(paper.address, price, '0x', {from: buyer});

    const event = await inLogs(await extractEvent(paper), 'Purchase');

    forSale.should.be.equal(true);
    event.args.buyer.should.be.equal(buyer);
    event.args.price.should.be.bignumber.equal(price);
  });

  describe('test with transferAndCall', () => {
    it('works for purchase by transferring token without PreSigned function (version 3 of purchase)', async () => {
      const beforePurchase = await token.balanceOf(buyer);

      await token.transferAndCall(paper.address, price, '0x', {from: buyer});

      const afterPurchase = await token.balanceOf(buyer);
      const isPurchased = await paper.isPurchased(buyer);
      const balanceOfSeller = await token.balanceOf(seller);

      const event = await inLogs(await extractEvent(paper), 'Purchase');

      afterPurchase.should.be.bignumber.not.equal(beforePurchase);
      isPurchased.should.be.equal(true);
      balanceOfSeller.should.be.bignumber.not.equal(0);
      event.args.buyer.should.be.equal(buyer);
      event.args.price.should.be.bignumber.equal(price);
    });

    it('should be stop sale when sold out', async () => {
      await inTransaction(paper.soldOut({from: seller}), 'SoldOut');

      const forSale = await paper.forSale();

      forSale.should.be.equal(false);
      await assertRevert(token.transferAndCall(paper.address, price, '0x', {from: buyer}))
    });

    it('should be able to resale product', async () => {
      await paper.soldOut({from: seller});
      await inTransaction(paper.resale({from: seller}), 'Resale');

      const forSale = await paper.forSale();
      await token.transferAndCall(paper.address, price, '0x', {from: buyer});

      const event = await inLogs(await extractEvent(paper), 'Purchase');

      forSale.should.be.equal(true);
      event.args.buyer.should.be.equal(buyer);
      event.args.price.should.be.bignumber.equal(price);
    });
  });
});
