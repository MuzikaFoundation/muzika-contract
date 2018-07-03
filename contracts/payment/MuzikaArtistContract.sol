pragma solidity ^0.4.24;

import '../../zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../lib/ApprovalAndCallFallBack.sol';
import "../lib/LibArtistPaymentInterface.sol";
import './MuzikaPaperContract.sol';

/**
 * @dev Work In Progress (do not deploy this contract to production)
 */
contract MuzikaArtistContract is Ownable {
  LibArtistPaymentInterface.Artist internal _artist;

  using LibArtistPaymentInterface for LibArtistPaymentInterface.Artist;

//  event Purchase(address indexed buyer, uint price);
//  event SoldOut(uint at);
//  event Resale(uint at);

  constructor(
    address _artistAddr,
    address[] _distributor,
    uint[] _distFees,
    uint[] _distCloseTimes,
    uint256[] _maxProfits
  ) public {
    _artist.create(_artistAddr, _distributor, _distFees, _distCloseTimes, _maxProfits);
  }

  function artist() public view returns (address) {
    return _artist.artist();
  }

  function distribute() public returns (bool) {
    return _artist.distribute();
  }

  function createPaper(
    uint256 _price,
    string _ipfsFileHash,
    string _originalFileHash
  ) public {
    _artist.insertPaperContract(new MuzikaPaperContract(address(this), _price, _ipfsFileHash, _originalFileHash));
  }

  function papers() public view returns (address[]) {
    return _artist._papers;
  }
}
