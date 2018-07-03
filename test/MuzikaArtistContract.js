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
const MuzikaArtistContract = artifacts.require('MuzikaArtistContract');
const PreSignedContract = artifacts.require('PreSignedContract');
const LibPaperPayment = artifacts.require('LibPaperPayment');
const LibArtistPayment = artifacts.require('LibArtistPayment');
const Dispatcher = artifacts.require('Dispatcher');
const DispatcherStorage = artifacts.require('DispatcherStorage');

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

contract('MuzikaArtistContract', ([_, owner, seller, sellerWithDist, buyer1, buyer2, distributor1, distributor2, distributor3]) => {
	const initialSupply = 10000;
	let token;
	let artist, paper, artistWithDists;

	const ipfsFileHash = 'QmNbs8stghYQMSTiC28aonneZHAk2dTJmMehJLJWR3xY7u';
	const originalFileHash = 'bea69d582a37712a0e70be4683c682ad9eaefb3078d59d1b222524cff6ef7b17';
	const price = 500;

	// generate a random price between [100, 500)
	const randomPrice = Math.floor(Math.random() * 400 + 100);
	const distributors = [distributor1, distributor2, distributor3];
	const distRatios = [
		Math.floor(Math.random() * 4000) + 1000,    // random ratio between [10%, 50%)
		3000,                                       // 30%
		2000                                        // 20%
	];
	const distCloseTime = [
		0,                                                // no close time
		Math.floor(new Date().getTime() / 1000) - 3600,   // closed 1 hours ago, so distributor2 would not get token.
		Math.floor(new Date().getTime() / 1000) + 3600    // will be closed after 1 hours, so distributor3 will get token.
	];
	const maxDists = [
		0,    // no maximum.
		0,    // no maximum.
		10    // distributor3 can get the token maximum 10.
	];

	// sign function
	let sign = null;

	let backedUpPaperContractBinary = MuzikaPaperContract.bytecode;
	let backedUpLibPaperPaymentBinary = LibPaperPayment.bytecode;

	let backedUpArtistContractBinary = MuzikaArtistContract.bytecode;

	afterEach(() => {
		// Restore bytecode of paper contract
		MuzikaPaperContract.bytecode = backedUpPaperContractBinary;
		LibPaperPayment.bytecode = backedUpLibPaperPaymentBinary;

		MuzikaArtistContract.bytecode = backedUpArtistContractBinary;
	});

	beforeEach(async () => {
		token = await MuzikaCoin.new(initialSupply, {from: owner});

		/* Manually replace address of PreSignedContract in compile stage
		 * So, you should not be input to the constructor on contracts
		 */
		LibPaperPayment.bytecode = LibPaperPayment.bytecode
			.replace('1111222233334444555566667777888899990000', PreSignedContract.address.slice(2))
			.replace('9999888877776666555544443333222211110000', token.address.slice(2));

		MuzikaArtistContract.bytecode = MuzikaArtistContract.bytecode
			.replace('9999888877776666555544443333222211110000', token.address.slice(2));

		const libPaper = await LibPaperPayment.new({from: owner});
		const dispatcherStorage = await DispatcherStorage.deployed();

		MuzikaPaperContract.link('LibPaperPaymentInterface', Dispatcher.address);
		MuzikaArtistContract.link('LibPaperPaymentInterface', Dispatcher.address);

		// Proxy library
		await dispatcherStorage.replace(libPaper.address, {from: _});

		paper = await MuzikaPaperContract.new(
			seller,
			price,
			ipfsFileHash,
			originalFileHash,
			{from: seller}
		);

		artist = await MuzikaArtistContract.new(
			seller, [], [], [], [],
			{from: seller}
		);

		artistWithDists = await MuzikaArtistContract.new(
			sellerWithDist,
			distributors,
			distRatios,
			distCloseTime,
			maxDists
		);

		await artistWithDists.createPaper(randomPrice, ipfsFileHash, originalFileHash);

		await token.transfer(buyer1, 5000, {from: owner});
		await token.transfer(buyer2, 5000, {from: owner});
		sign = signToken.bind(null, token.address, buyer1, MODE_INC_APPROVAL);
	});

	it('should be equal to information', async () => {
		const artistAddress1 = await artist.artist();
		const artistAddress2 = await artistWithDists.artist();

		artistAddress1.should.be.equal(seller);
		artistAddress2.should.be.equal(sellerWithDist);
	});

	it('works for creating 5 new papers', async () => {
		await artist.createPaper(price, ipfsFileHash, originalFileHash);
		await artist.createPaper(price, ipfsFileHash, originalFileHash);
		await artist.createPaper(price, ipfsFileHash, originalFileHash);
		await artist.createPaper(price, ipfsFileHash, originalFileHash);
		await artist.createPaper(price, ipfsFileHash, originalFileHash);
		const papers = await artist.papers();
		console.log(papers);

		papers.length.should.be.equal(5);
	});

	it('works for purchase and distribution', async () => {
		console.log('PAPER PRICE : ', randomPrice);

		const beforeBuyer1Balance = await token.balanceOf(buyer1);
		const beforeBuyer2Balance = await token.balanceOf(buyer2);

		const papers = await artistWithDists.papers();
		const paper = papers[0];

		// just one paper should be in the artist contract
		papers.length.should.be.equal(1);

		// purchase one paper by buyer.
		await token.increaseApprovalAndCall(paper, randomPrice, '0x', {from: buyer1});
		await token.increaseApprovalAndCall(paper, randomPrice, '0x', {from: buyer2});

		const afterBuyer1Balance = await token.balanceOf(buyer1);
		const afterBuyer2Balance = await token.balanceOf(buyer2);

		const contractBalance = await token.balanceOf(artistWithDists.address);

		contractBalance.should.be.bignumber.equal((randomPrice - Math.floor(randomPrice / 100) * 5) * 2);
		afterBuyer1Balance.should.be.bignumber.equal(beforeBuyer1Balance - randomPrice);
		afterBuyer2Balance.should.be.bignumber.equal(beforeBuyer2Balance - randomPrice);

		await artistWithDists.distribute({ from: sellerWithDist });

		const artistBalance = await token.balanceOf(sellerWithDist);
		const dist1Balance = await token.balanceOf(distributor1);
		const dist2Balance = await token.balanceOf(distributor2);
		const dist3Balance = await token.balanceOf(distributor3);

		console.log(artistBalance, dist1Balance, dist2Balance, dist3Balance);

		dist1Balance.should.be.bignumber.equal(Math.floor(contractBalance * distRatios[0] / 10000));

		// distributor 2 would get no MZK since the close time in artist contract is defined.
		dist2Balance.should.be.bignumber.equal(0);

		// distributor 3 would get only 10 MZK, since the distributor can get maximum 10.
		dist3Balance.should.be.bignumber.equal(10);

		// all the remain to the artist.
		artistBalance.should.be.bignumber.equal(contractBalance - dist1Balance - dist2Balance - dist3Balance);
	});
});