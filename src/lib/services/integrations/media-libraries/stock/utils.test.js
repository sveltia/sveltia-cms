// @ts-nocheck
import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  fetchJSON,
  fetchPagedResults,
  getSupportedLocale,
} from '$lib/services/integrations/media-libraries/stock/utils';

const mockLocale = vi.hoisted(() => ({ current: 'en-US' }));

vi.mock('@sveltia/i18n', () => ({ locale: mockLocale }));
vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn(async () => undefined) }));

beforeEach(() => {
  mockLocale.current = 'en-US';
  vi.stubGlobal('fetch', vi.fn());
});

describe('getSupportedLocale()', () => {
  const locales = ['en-US', 'pt-BR', 'ja-JP'];

  test('returns an exact match regardless of case', () => {
    mockLocale.current = 'pt-br';
    expect(getSupportedLocale(locales, 'en-US')).toBe('pt-BR');
  });

  test('falls back to the same language', () => {
    mockLocale.current = 'pt-PT';
    expect(getSupportedLocale(locales, 'en-US')).toBe('pt-BR');

    mockLocale.current = 'ja';
    expect(getSupportedLocale(locales, 'en-US')).toBe('ja-JP');
  });

  test('falls back to the given locale', () => {
    mockLocale.current = 'fr-FR';
    expect(getSupportedLocale(locales, 'en-US')).toBe('en-US');
  });

  test('works with language-only codes', () => {
    mockLocale.current = 'de-AT';
    expect(getSupportedLocale(['en', 'de'], 'en')).toBe('de');
  });
});

describe('fetchJSON()', () => {
  test('parses a successful response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ hits: [] }) });

    expect(await fetchJSON('https://example.com/api', { headers: { a: 'b' } })).toEqual({
      hits: [],
    });
    expect(fetch).toHaveBeenCalledWith('https://example.com/api', { headers: { a: 'b' } });
  });

  test('omits the request options when not given', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });

    await fetchJSON('https://example.com/api');

    expect(fetch).toHaveBeenCalledWith('https://example.com/api');
  });

  test('throws when the request failed', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 });

    await expect(fetchJSON('https://example.com/api')).rejects.toThrow(
      'Failed to fetch https://example.com/api: 401',
    );
  });
});

describe('fetchPagedResults()', () => {
  /**
   * Extract the results from a page.
   * @param {{ items: number[], more: boolean }} response Response.
   * @returns {{ results: number[], hasMore: boolean }} Results and whether another page follows.
   */
  const parsePage = ({ items, more }) => ({ results: items, hasMore: more });

  test('fetches pages until the API reports no more', async () => {
    const fetchPage = vi.fn(async (page) => ({ items: [page], more: page < 2 }));
    const results = await fetchPagedResults({ maxPages: 5, fetchPage, parsePage });

    expect(results).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  test('stops at the page limit', async () => {
    const fetchPage = vi.fn(async (page) => ({ items: [page], more: true }));
    const results = await fetchPagedResults({ maxPages: 3, fetchPage, parsePage });

    expect(results).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('passes the page number to the parser', async () => {
    const fetchPage = vi.fn(async () => ({ total: 2 }));
    /**
     * Extract the results from a page, using the page number.
     * @param {{ total: number }} response Response.
     * @param {number} page Page number.
     * @returns {{ results: number[], hasMore: boolean }} Results and whether another page follows.
     */
    const parseNumberedPage = ({ total }, page) => ({ results: [page], hasMore: page < total });

    const results = await fetchPagedResults({
      maxPages: 5,
      fetchPage,
      parsePage: parseNumberedPage,
    });

    expect(results).toEqual([1, 2]);
  });

  test('propagates a failed page', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(fetchPagedResults({ maxPages: 2, fetchPage, parsePage })).rejects.toThrow('boom');
  });
});
