import { sleep } from '@sveltia/utils/misc';
import { describe, expect, it, vi } from 'vitest';

import { fetchPages } from '$lib/services/integrations/media-libraries/paging';

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
