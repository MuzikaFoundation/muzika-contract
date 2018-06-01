const assert = require('chai').assert;

export async function inLogs (logs, eventName) {
  const event = logs.find(e => e.event === eventName);
  assert.exists(event);
  return event;
}

export async function inTransaction (tx, eventName) {
  const { logs } = await tx;
  return inLogs(logs, eventName);
}
