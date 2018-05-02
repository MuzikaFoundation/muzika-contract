export default async (promise, msg) => {
  try {
    await promise;
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0 || error.message.search('invalid opcode') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);

    return;
  }

  assert(false, msg || 'Expected revert not received');
};
