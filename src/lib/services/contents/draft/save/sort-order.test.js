import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';

import { assignManualSortOrder } from './sort-order';

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/entries/reorder/config', () => ({
  getOrderFieldKey: vi.fn(() => undefined),
}));

/**
 * Build a draft with the given values.
 * @param {Record<string, Record<string, any>>} currentValues Values keyed by locale.
 * @returns {any} Draft.
 */
const createDraft = (currentValues) => ({
  collection: { name: 'tags', _type: 'entry', _i18n: { defaultLocale: 'en' } },
  currentValues,
});

describe('assignManualSortOrder', () => {
  beforeEach(() => {
    vi.mocked(getOrderFieldKey).mockReturnValue('order');
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
  });

  it('leaves the values alone when the collection has no order field', () => {
    vi.mocked(getOrderFieldKey).mockReturnValue(undefined);

    const draft = createDraft({ en: { title: 'Hello' } });

    assignManualSortOrder(draft);
    expect(draft.currentValues.en).toEqual({ title: 'Hello' });
  });

  it('assigns the next order after the highest existing one to every locale', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue(
      /** @type {any} */ ([
        { locales: { en: { content: { order: 3 } } } },
        { locales: { en: { content: { order: 'x' } } } },
        { locales: {} },
      ]),
    );

    const draft = createDraft({ en: { title: 'Hello' }, fr: { title: 'Bonjour' } });

    assignManualSortOrder(draft);
    expect(draft.currentValues.en.order).toBe(4);
    expect(draft.currentValues.fr.order).toBe(4);
  });

  it('starts from 1 when no entry has an order', () => {
    const draft = createDraft({ en: {} });

    assignManualSortOrder(draft);
    expect(draft.currentValues.en.order).toBe(1);
  });

  it('skips the orders already taken by the given number of entries', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue(
      /** @type {any} */ ([{ locales: { en: { content: { order: 5 } } } }]),
    );

    const draft = createDraft({ en: {} });

    assignManualSortOrder(draft, 2);
    expect(draft.currentValues.en.order).toBe(8);
  });
});
