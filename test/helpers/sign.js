import ethUtil from 'ethereumjs-util';
import ethAbi from 'ethereumjs-abi';
import sigUtil from 'eth-sig-util';
import {promisify} from './promisify';

export const signTypedDataSchema = [
  'bytes8 Mode',
  'address Token',
  'address To',
  'uint256 Amount',
  'uint256 Fee',
  'uint256 Nonce',
];

export const signMessageTypes = signTypedDataSchema.map(v => v.split(' ')[0]);
export const signSchemaTypes = signTypedDataSchema.map(v => 'string');

export const MODE_TRANSFER = "Transfer";
export const MODE_APPROVAL = "Approval";
export const MODE_INC_APPROVAL = "IncApprv";
export const MODE_DEC_APPROVAL = "DecApprv";

export async function signToken(_tokenAddress, _from, _mode, _to, _amount, _fee, _nonce) {
  let message = ethAbi.soliditySHA3(
    ['bytes8', 'address', 'address', 'uint256', 'uint256', 'uint256'],
    [_mode, _tokenAddress, _to, _amount, _fee, _nonce]
  );
  return await promisify(web3.eth.sign, _from, ethUtil.bufferToHex(message));
}

export async function trezorSignToken(_tokenAddress, _fromPrivateKey, _mode, _to, _amount, _fee, _nonce) {
  const fromPrivKeyBuf = Buffer.from(_fromPrivateKey.slice(2), 'hex');

  const rawSig = ethUtil.ecsign(
    ethAbi.soliditySHA3(
      ['string', 'bytes32'],
      [
        '\x19Ethereum Signed Message:\n\x20',
        ethAbi.soliditySHA3(
          ['bytes8', 'address', 'address', 'uint256', 'uint256', 'uint256'],
          [_mode, _tokenAddress, _to, _amount, _fee, _nonce]
        )
      ]
    ),
    fromPrivKeyBuf
  );
  return ethUtil.bufferToHex(sigUtil.concatSig(rawSig.v, rawSig.r, rawSig.s));
}

export async function signTypedDataToken(_tokenAddress, _fromPrivateKey, _mode, _to, _amount, _fee, _nonce) {
  const fromPrivKeyBuf = Buffer.from(_fromPrivateKey.slice(2), 'hex');

  const typedData = [
    {type: 'bytes8', name: 'Mode', value: _mode},
    {type: 'address', name: 'Token', value: _tokenAddress},
    {type: 'address', name: 'To', value: _to},
    {type: 'uint256', name: 'Amount', value: _amount},
    {type: 'uint256', name: 'Fee', value: _fee},
    {type: 'uint256', name: 'Nonce', value: _nonce},
  ];

  return sigUtil.signTypedData(fromPrivKeyBuf, {data: typedData});
}
