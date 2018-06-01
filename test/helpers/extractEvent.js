import {promisify} from './promisify';

export function extractEvent(contractInstance) {
  return new Promise((resolve, reject) => {
    const event = contractInstance.allEvents({from: 0, to: 'latest'});

    event.get((err, data) => {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}
