import {promisify} from './helpers/promisify';
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

contract('MuzikaPaperContract', ([owner, seller, buyer, anotherAccount]) => {
  const initialSupply = 10000;
  let token;
  let paper;

  const ipfsFileHash = 'QmNbs8stghYQMSTiC28aonneZHAk2dTJmMehJLJWR3xY7u';
  const originalFileHash = 'bea69d582a37712a0e70be4683c682ad9eaefb3078d59d1b222524cff6ef7b17';
  const price = 500;

  // sign function
  let sign = null;

  let backedUpPaperContractBinary = MuzikaPaperContract.unlinked_binary;
  let backedUpLibPaperPaymentBinary = LibPaperPayment.unlinked_binary;

  afterEach(() => {
    // Restore bytecode of paper contract
    MuzikaPaperContract.unlinked_binary = backedUpPaperContractBinary;
    LibPaperPayment.unlinked_binary = backedUpLibPaperPaymentBinary;
  });

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply);

    /* Manually replace address of PreSignedContract in compile stage
     * So, you should not be input to the constructor on contracts
     */
    LibPaperPayment.unlinked_binary = LibPaperPayment.unlinked_binary
      .replace('1111222233334444555566667777888899990000', PreSignedContract.address.slice(2))
      .replace('9999888877776666555544443333222211110000', token.address.slice(2));

    const lib = await LibPaperPayment.new();
    const dispatcherStorage = await DispatcherStorage.deployed();

    MuzikaPaperContract.link('LibPaperPaymentInterface', Dispatcher.address);

    // Proxy library
    await dispatcherStorage.replace(lib.address);

    paper = await MuzikaPaperContract.new(
      seller,
      price,
      ipfsFileHash,
      originalFileHash
    );

    await token.transfer(buyer, 5000, {from: owner});
    sign = signToken.bind(null, token.address, buyer, MODE_INC_APPROVAL);
  });

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

  it('works for purchase by increase approval without PreSigned function (version 3 of purchase)', async () => {
    const beforePurchase = await token.balanceOf(buyer);

    // await token.increaseApproval(paper.address, price, {from: buyer});
    const callData = ethUtil.bufferToHex(ethAbi.simpleEncode('purchase(address)', buyer));
    await token.increaseApprovalAndCall(paper.address, price, callData, {from: buyer});

    const afterPurchase = await token.balanceOf(buyer);
    const isPurchased = await paper.isPurchased(buyer);
    const balanceOfSeller = await token.balanceOf(seller);

    afterPurchase.should.be.bignumber.not.equal(beforePurchase);
    isPurchased.should.be.equal(true);
    balanceOfSeller.should.be.bignumber.not.equal(0);
  });
});
