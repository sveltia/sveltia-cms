import { sleep } from '@sveltia/utils/misc';
import { describe, expect, it, vi } from 'vitest';

import { fetchPages, readNumberedPages, readPages } from '$lib/services/utils/paging';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn(async () => undefined) }));

describe('fetchPages()', () => {
  /**
   * Create a page fetcher that serves the given pages, chained by their index as the cursor.
   * @param {number[][]} pages Results of each page.
   * @returns {import('vitest').Mock} Page fetcher.
   */
  const createFetcher = (pages) =>
    vi.fn(async (/** @type {number | undefined} */ cursor) => {
      const index = cursor ?? 0;

      return { results: pages[index], next: index + 1 < pages.length ? index + 1 : null };
    });

  it('should follow the cursor until the last page', async () => {
    const fetchPage = createFetcher([[1, 2], [3], [4]]);

    expect(await fetchPages(fetchPage)).toEqual([1, 2, 3, 4]);
    expect(fetchPage.mock.calls).toEqual([[undefined], [1], [2]]);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it('should stop at the maximum number of pages without waiting after the last one', async () => {
    const fetchPage = createFetcher([[1], [2], [3]]);

    expect(await fetchPages(fetchPage, { maxPages: 2 })).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('should stop when the next cursor is missing', async () => {
    const fetchPage = vi.fn(async () => ({ results: ['a'] }));

    expect(await fetchPages(fetchPage)).toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('should propagate an error thrown by the page fetcher', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(fetchPages(fetchPage)).rejects.toThrow('boom');
  });
});

describe('readPages()', () => {
  /**
   * Create a page fetcher that serves the given pages, numbered from 1 as the cursor.
   * @param {number[][]} pages Results of each page.
   * @returns {import('vitest').Mock} Page fetcher.
   */
  const createFetcher = (pages) =>
    vi.fn(async (/** @type {number | undefined} */ page = 1) => ({
      results: pages[page - 1],
      next: page < pages.length ? page + 1 : undefined,
    }));

  it('should report the results as complete when the last page is reached', async () => {
    const fetchPage = createFetcher([[1], [2]]);

    expect(await readPages(fetchPage)).toEqual({ results: [1, 2], complete: true });
  });

  it('should report the results as incomplete when another page follows the last one read', async () => {
    const fetchPage = createFetcher([[1], [2], [3]]);

    expect(await readPages(fetchPage, { maxPages: 2 })).toEqual({
      results: [1, 2],
      complete: false,
    });
  });

  it('should not wait between pages when the delay is 0', async () => {
    const fetchPage = createFetcher([[1], [2], [3]]);

    expect((await readPages(fetchPage, { delay: 0 })).results).toEqual([1, 2, 3]);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('readNumberedPages()', () => {
  it('should fetch the pages by number until one comes back short', async () => {
    const pages = [[1, 2], [3, 4], [5]];
    const fetchPage = vi.fn(async (/** @type {number} */ page) => pages[page - 1]);

    expect(await readNumberedPages(fetchPage, { pageSize: 2, delay: 0 })).toEqual({
      results: [1, 2, 3, 4, 5],
      complete: true,
    });
    expect(fetchPage.mock.calls).toEqual([[1], [2], [3]]);
  });

  it('should report the results as incomplete when the last page read is full', async () => {
    const fetchPage = vi.fn(async () => [1, 2]);

    expect(await readNumberedPages(fetchPage, { pageSize: 2, maxPages: 3 })).toEqual({
      results: [1, 2, 1, 2, 1, 2],
      complete: false,
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
