import { sleep } from '@sveltia/utils/misc';

/**
 * How many times, and how often, a service is read while it works out something in the background
 * that usually takes a second or two, such as a merge request’s mergeability after a push.
 */
export const SETTLE_POLL = { attempts: 10, interval: 1000 };

/**
 * Read a value, again and again while it hasn’t settled, until it has or the attempts run out, in
 * which case the last unsettled value is returned as is. The reads are spaced out by the given
 * interval; there is no wait before the first one, nor after the last one.
 * @template T
 * @param {() => Promise<T>} read Function to read the value.
 * @param {(value: T) => boolean} isSettled Function to check whether the value has settled.
 * @param {object} options Options.
 * @param {number} options.attempts Number of reads at most, including the first one.
 * @param {number} options.interval Time to wait between two reads, in milliseconds.
 * @returns {Promise<T>} Last value read.
 */
export const pollUntil = async (read, isSettled, { attempts, interval }) => {
  const value = await read();

  if (isSettled(value) || attempts <= 1) {
    return value;
  }

  await sleep(interval);

  return pollUntil(read, isSettled, { attempts: attempts - 1, interval });
};
