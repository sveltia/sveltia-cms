import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getDefaultPanes,
  getPanesEditingLocale,
  getPaneSizes,
  getPaneStateKey,
  getRestoredPanes,
  savePaneState,
} from '$lib/services/contents/editor/panes';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';

/**
 * @import { EntryEditorPane } from '$lib/types/private';
 */

vi.mock('$lib/services/contents/editor', () => ({ MIN_PANE_SIZE: 30 }));
vi.mock('$lib/services/contents/editor/settings', () => ({
  entryEditorSettings: { current: undefined },
}));

/** @type {EntryEditorPane} */
const editEn = { mode: 'edit', locale: 'en' };
/** @type {EntryEditorPane} */
const editFr = { mode: 'edit', locale: 'fr' };
/** @type {EntryEditorPane} */
const previewEn = { mode: 'preview', locale: 'en' };

describe('getPaneStateKey()', () => {
  test('uses the collection name', () => {
    expect(getPaneStateKey({ collection: /** @type {any} */ ({ name: 'posts' }) })).toBe('posts');
  });

  test('joins the collection and file names', () => {
    expect(
      getPaneStateKey({
        collection: /** @type {any} */ ({ name: 'settings' }),
        collectionFile: /** @type {any} */ ({ name: 'general' }),
      }),
    ).toBe('settings|general');
  });

  test('is undefined without a collection', () => {
    expect(getPaneStateKey({})).toBeUndefined();
  });
});

describe('getPaneSizes()', () => {
  test('is empty without panes', () => {
    expect(getPaneSizes({ firstPane: null, secondPane: null })).toEqual([0, 0, 0]);
  });

  test('gives a lone pane the whole width', () => {
    expect(getPaneSizes({ firstPane: editEn, secondPane: null })).toEqual([100, 0, 0]);
    expect(getPaneSizes({ firstPane: null, secondPane: previewEn })).toEqual([0, 100, 0]);
  });

  test('uses sound saved widths', () => {
    expect(
      getPaneSizes({
        firstPane: { ...editEn, width: 40 },
        secondPane: { ...previewEn, width: 60 },
      }),
    ).toEqual([40, 60, 30]);
  });

  test('splits evenly without saved widths, or when they don’t add up or are too small', () => {
    expect(getPaneSizes({ firstPane: editEn, secondPane: previewEn })).toEqual([50, 50, 30]);
    expect(
      getPaneSizes({
        firstPane: { ...editEn, width: 40 },
        secondPane: { ...previewEn, width: 50 },
      }),
    ).toEqual([50, 50, 30]);
    expect(
      getPaneSizes({
        firstPane: { ...editEn, width: 20 },
        secondPane: { ...previewEn, width: 80 },
      }),
    ).toEqual([50, 50, 30]);
  });
});

describe('getRestoredPanes()', () => {
  const base = {
    allLocales: ['en', 'fr', 'de'],
    defaultLocale: 'en',
    canPreview: true,
    showPreview: true,
    showSecondPane: true,
  };

  test('restores the saved panes', () => {
    expect(getRestoredPanes({ ...base, savedPanes: [editEn, previewEn] })).toEqual([
      editEn,
      previewEn,
    ]);
  });

  test('opens the URL locale in both panes instead of the saved ones', () => {
    expect(
      getRestoredPanes({ ...base, savedPanes: [editEn, previewEn], editorLocale: 'fr' }),
    ).toEqual([editFr, { mode: 'preview', locale: 'fr' }]);
  });

  test('restores nothing without a full saved state', () => {
    expect(getRestoredPanes(base)).toBeUndefined();
    expect(getRestoredPanes({ ...base, savedPanes: [editEn, null] })).toBeUndefined();
  });

  test('restores nothing for a locale the entry doesn’t have', () => {
    expect(
      getRestoredPanes({ ...base, savedPanes: [{ mode: 'edit', locale: 'ja' }, previewEn] }),
    ).toBeUndefined();
    expect(
      getRestoredPanes({ ...base, savedPanes: [editEn, { mode: 'preview', locale: 'ja' }] }),
    ).toBeUndefined();
  });

  test('restores nothing when the second pane is hidden', () => {
    expect(
      getRestoredPanes({ ...base, savedPanes: [editEn, previewEn], showSecondPane: false }),
    ).toBeUndefined();
  });

  test('restores nothing for a preview pane while the preview is unavailable', () => {
    expect(
      getRestoredPanes({ ...base, savedPanes: [editEn, previewEn], showPreview: false }),
    ).toBeUndefined();
    expect(
      getRestoredPanes({ ...base, savedPanes: [previewEn, editEn], canPreview: false }),
    ).toBeUndefined();
    // Two edit panes are fine
    expect(getRestoredPanes({ ...base, savedPanes: [editEn, editFr], showPreview: false })).toEqual(
      [editEn, editFr],
    );
  });

  test('keeps the default locale first with exactly two locales', () => {
    expect(
      getRestoredPanes({ ...base, allLocales: ['en', 'fr'], savedPanes: [editFr, editEn] }),
    ).toBeUndefined();
    expect(
      getRestoredPanes({ ...base, allLocales: ['en', 'fr'], savedPanes: [editEn, editFr] }),
    ).toEqual([editEn, editFr]);
  });
});

describe('getDefaultPanes()', () => {
  const base = {
    defaultLocale: 'en',
    allLocales: ['en', 'fr'],
    i18nEnabled: true,
    canPreview: true,
    showPreview: true,
    showSecondPane: true,
    singlePane: false,
  };

  test('edits the default locale with a preview', () => {
    expect(getDefaultPanes(base)).toEqual([editEn, previewEn]);
  });

  test('keeps the current locale', () => {
    expect(getDefaultPanes({ ...base, currentLocale: 'fr' })).toEqual([
      editFr,
      { mode: 'preview', locale: 'fr' },
    ]);
  });

  test('shows one pane on a small screen or when the second pane is hidden', () => {
    expect(getDefaultPanes({ ...base, singlePane: true })).toEqual([editEn, null]);
    expect(getDefaultPanes({ ...base, showSecondPane: false })).toEqual([editEn, null]);
  });

  test('edits another locale when there’s no preview', () => {
    expect(getDefaultPanes({ ...base, showPreview: false })).toEqual([editEn, editFr]);
    expect(getDefaultPanes({ ...base, canPreview: false, currentLocale: 'fr' })).toEqual([
      editFr,
      editEn,
    ]);
  });

  test('shows one pane when there’s neither a preview nor another locale', () => {
    expect(
      getDefaultPanes({ ...base, showPreview: false, i18nEnabled: false, allLocales: ['en'] }),
    ).toEqual([editEn, null]);
  });
});

describe('getPanesEditingLocale()', () => {
  test('leaves the panes alone when the locale is already being edited', () => {
    expect(
      getPanesEditingLocale({ firstPane: editEn, secondPane: previewEn, locale: 'en' }),
    ).toBeUndefined();
    expect(
      getPanesEditingLocale({ firstPane: editFr, secondPane: editEn, locale: 'en' }),
    ).toBeUndefined();
  });

  test('switches a preview pane to edit mode', () => {
    expect(
      getPanesEditingLocale({ firstPane: editEn, secondPane: previewEn, locale: 'fr' }),
    ).toEqual([editEn, editFr]);
    expect(
      getPanesEditingLocale({ firstPane: previewEn, secondPane: editEn, locale: 'fr' }),
    ).toEqual([editFr, editEn]);
  });

  test('repurposes the second edit pane', () => {
    expect(getPanesEditingLocale({ firstPane: editEn, secondPane: editFr, locale: 'de' })).toEqual([
      editEn,
      { mode: 'edit', locale: 'de' },
    ]);
  });

  test('repurposes the only pane', () => {
    expect(getPanesEditingLocale({ firstPane: editEn, secondPane: null, locale: 'fr' })).toEqual([
      editFr,
      null,
    ]);
  });
});

describe('savePaneState()', () => {
  beforeEach(() => {
    entryEditorSettings.current = undefined;
  });

  test('adds the state to empty settings', () => {
    savePaneState('posts', [editEn, previewEn]);

    expect(entryEditorSettings.current).toEqual({ paneStates: { posts: [editEn, previewEn] } });
  });

  test('keeps the other settings and collections', () => {
    entryEditorSettings.current = {
      showPreview: false,
      paneStates: { pages: [editFr, editEn] },
    };

    savePaneState('posts', [editEn, previewEn]);

    expect(entryEditorSettings.current).toEqual({
      showPreview: false,
      paneStates: { pages: [editFr, editEn], posts: [editEn, previewEn] },
    });
  });
});
