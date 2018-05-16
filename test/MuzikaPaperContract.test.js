import {promisify} from './helpers/promisify';
import {MODE_INC_APPROVAL, signToken} from './helpers/sign';

const BigNumber = web3.BigNumber;
const MuzikaCoin = artifacts.require('MuzikaCoin');
const MuzikaPaperContract = artifacts.require('MuzikaPaperContract');
const PreSignedContract = artifacts.require('PreSignedContract');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MuzikaCoin', ([_, owner, seller, buyer, anotherAccount]) => {
  const initialSupply = 10000;
  let token;
  let paper;

  const ipfsFileHash = 'QmNbs8stghYQMSTiC28aonneZHAk2dTJmMehJLJWR3xY7u';
  const originalFileHash = 'bea69d582a37712a0e70be4683c682ad9eaefb3078d59d1b222524cff6ef7b17';
  const price = 500;

  // sign function
  let sign = null;

  let backedUpPaperContractBinary = MuzikaPaperContract.unlinked_binary;

  afterEach(() => {
    // Restore bytecode of paper contract
    MuzikaPaperContract.unlinked_binary = backedUpPaperContractBinary;
  });

  beforeEach(async () => {
    token = await MuzikaCoin.new(initialSupply, {from: owner});

    /* Manually replace address of PreSignedContract in compile stage
     * So, you should not be input to the constructor on contracts
     */
    MuzikaPaperContract.unlinked_binary = MuzikaPaperContract.unlinked_binary
      .replace('1111222233334444555566667777888899990000', PreSignedContract.address.slice(2))
      .replace('9999888877776666555544443333222211110000', token.address.slice(2));

    paper = await MuzikaPaperContract.new(
      seller,
      price,
      ipfsFileHash,
      originalFileHash,
      {from: owner}
    );

    await token.transfer(buyer, 5000, {from: owner});

    sign = signToken.bind(null, token.address, buyer, MODE_INC_APPROVAL);
  });

  it('should support paper billing successfully', async () => {
    let nonce = await promisify(web3.eth.getTransactionCount, buyer);
    let signature = await sign(paper.address, price, 0, nonce);

    const beforePurchase = await token.balanceOf(buyer);

    // console.log('Estimate Increase Approval:', await token.increaseApproval.estimateGas(paper.address, price, {from: buyer}));
    // await token.increaseApproval(paper.address, price, {from: buyer});
    console.log('Estimate Purchase:', await paper.purchase.estimateGas(nonce, 1, signature));
    await paper.purchase(nonce, 1, signature);

    const afterPurchase = await token.balanceOf(buyer);
    const isPurchased = await paper.isPurchased(buyer);
    const balanceOfSeller = await token.balanceOf(seller);

    afterPurchase.should.be.bignumber.not.equal(beforePurchase);
    isPurchased.should.be.equal(true);
    balanceOfSeller.should.be.bignumber.not.equal(0);
  });
});
