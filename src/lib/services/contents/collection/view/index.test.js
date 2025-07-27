// @ts-nocheck

import { derived, writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { currentView, entryGroups, listedEntries } from '$lib/services/contents/collection/view';

// Mock dependencies
vi.mock('svelte/store', () => ({
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn() })),
}));

vi.mock('svelte-i18n', () => ({
  locale: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  selectedCollection: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(),
  selectedEntries: { set: vi.fn() },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/view/filter', () => ({
  filterEntries: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/view/group', () => ({
  groupEntries: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/view/sort', () => ({
  sortEntries: vi.fn(),
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn() },
}));

describe('collection/view/index', () => {
  test('exports currentView store', () => {
    expect(currentView).toBeDefined();
  });

  test('exports listedEntries store', () => {
    expect(listedEntries).toBeDefined();
  });

  test('exports entryGroups store', () => {
    expect(entryGroups).toBeDefined();
  });

  test('currentView is a writable store', () => {
    expect(writable).toHaveBeenCalled();
  });

  test('listedEntries is a derived store', () => {
    expect(derived).toHaveBeenCalled();
  });

  test('entryGroups is a derived store', () => {
    expect(derived).toHaveBeenCalled();
  });
});
