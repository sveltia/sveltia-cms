import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  toast: { current: { id: 4, show: false, status: 'success', message: '' } },
}));

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, options) => `${key}:${options?.values?.count ?? ''}`),
}));

vi.mock('$lib/services/contents/editor', () => ({ listItemClipboardToast: mocks.toast }));

const { getPastedItemToast, showListItemClipboardToast } = await import('./paste-toast.js');

describe('showListItemClipboardToast()', () => {
  beforeEach(() => {
    mocks.toast.current = { id: 4, show: false, status: 'success', message: '' };
  });

  test('shows a new toast', () => {
    showListItemClipboardToast('error', 'Oops');

    expect(mocks.toast.current).toEqual({ id: 5, show: true, status: 'error', message: 'Oops' });
  });
});

describe('getPastedItemToast()', () => {
  test('warns about missing files first', () => {
    expect(getPastedItemToast({ droppedCount: 2, missingFileCount: 3 })).toEqual({
      status: 'warning',
      message: 'list_item_pasted_without_files:3',
    });
  });

  test('tells about the values left out', () => {
    expect(getPastedItemToast({ droppedCount: 2, missingFileCount: 0 })).toEqual({
      status: 'info',
      message: 'list_item_pasted_without_values:2',
    });
  });

  test('has nothing to tell about an item pasted as copied', () => {
    expect(getPastedItemToast({ droppedCount: 0, missingFileCount: 0 })).toBeUndefined();
  });
});
