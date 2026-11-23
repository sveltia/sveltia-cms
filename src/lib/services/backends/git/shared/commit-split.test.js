import { describe, expect, test } from 'vitest';

import {
  estimateRemainingCommits,
  getPayloadSize,
  isUploadFailure,
  sortAdditions,
  takeAdditions,
} from '$lib/services/backends/git/shared/commit-split';

describe('sortAdditions', () => {
  /**
   * Create a file addition.
   * @param {number} index Index.
   * @param {boolean} [isText] Whether the file is a text file, like an entry.
   * @returns {any} File addition.
   */
  const addition = (index, isText = false) => ({
    index,
    path: `file-${index}`,
    contents: 'a',
    data: isText ? 'text' : new Blob(['x']),
  });

  test('puts text files last', () => {
    const entry = addition(0, true);
    const image1 = addition(1);
    const image2 = addition(2);

    expect(sortAdditions([entry, image1, image2])).toEqual({
      queue: [image1, image2, entry],
      addedAgain: [],
    });
  });

  test('sets aside a file deleted and added again at the same path', () => {
    const addedAgain = addition(0);
    const image = addition(1);

    expect(sortAdditions([addedAgain, image], new Set(['file-0']))).toEqual({
      queue: [image],
      addedAgain: [addedAgain],
    });
  });
});

describe('takeAdditions', () => {
  /**
   * Create a file addition.
   * @param {number} index Index.
   * @param {number} size Size of the encoded contents.
   * @returns {any} File addition.
   */
  const addition = (index, size) => ({
    index,
    path: `file-${index}`,
    contents: 'a'.repeat(size),
  });

  test('takes as many additions as fit', () => {
    const queue = [addition(0, 40), addition(1, 60), addition(2, 1)];

    expect(takeAdditions(queue, 100)).toEqual([addition(0, 40), addition(1, 60)]);
    expect(queue).toEqual([addition(2, 1)]);
  });

  test('takes a single addition over the size on its own', () => {
    const queue = [addition(0, 200), addition(1, 1)];

    expect(takeAdditions(queue, 100)).toEqual([addition(0, 200)]);
    expect(queue).toEqual([addition(1, 1)]);
  });

  test('takes nothing from an empty queue', () => {
    expect(takeAdditions([], 100)).toEqual([]);
  });
});

describe('getPayloadSize', () => {
  test('adds up the size of the encoded contents', () => {
    expect(getPayloadSize(/** @type {any[]} */ ([{ contents: 'abc' }, { contents: 'de' }]))).toBe(
      5,
    );
  });

  test('takes no additions for an empty payload', () => {
    expect(getPayloadSize([])).toBe(0);
  });
});

describe('estimateRemainingCommits', () => {
  test('divides the payload by the commit size, rounding up', () => {
    const queue = /** @type {any[]} */ ([{ contents: 'a'.repeat(150) }, { contents: 'a' }]);

    expect(estimateRemainingCommits(queue, 100)).toBe(2);
    expect(estimateRemainingCommits(queue, 50)).toBe(4);
  });

  test('counts the last commit even without additions left', () => {
    expect(estimateRemainingCommits([], 100)).toBe(1);
  });
});

describe('isUploadFailure', () => {
  test('tells a request that took too long from other failures', () => {
    expect(isUploadFailure(new Error('Failed to send the request'))).toBe(true);

    [408, 413, 499, 502, 504].forEach((status) => {
      expect(
        isUploadFailure(new Error('Server responded with an error', { cause: { status } })),
      ).toBe(true);
    });

    expect(
      isUploadFailure(new Error('Server responded with an error', { cause: { status: 422 } })),
    ).toBe(false);
    expect(isUploadFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isUploadFailure(undefined)).toBe(false);
  });
});
