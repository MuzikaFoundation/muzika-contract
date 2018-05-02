export default (data, digits, contains0x) => {
  let bn = web3.toHex(data).toString(16).slice(2);

  if (digits) bn = web3.padLeft(bn, digits);
  if (contains0x) bn = '0x' + bn;

  return bn;
};
