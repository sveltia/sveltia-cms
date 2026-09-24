// @vitest-environment happy-dom
// @ts-nocheck

/**
 * The collection configuration and the entry being edited are handed to `createState()` as static
 * keys, so every draft opened for one collection hands out the very same objects. Two proxies of
 * the same configuration look like a change to every keyed `{#each}` block over the fields, and
 * Svelte answers the resulting mid-effect write by walking the derived graph below it without
 * memoizing — which is what hung a deeply nested entry editor.
 * @see https://github.com/sveltia/sveltia-cms/issues/1006
 *
 * These assertions need the client Svelte runtime, where `$state` actually proxies. The other
 * tests in this directory run in the default Node environment, where it does nothing and the
 * identity checks below would hold whether or not the static keys were passed.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/backup', () => ({ restoreBackupIfNeeded: vi.fn() }));

vi.mock('$lib/services/contents/draft/create/duplicate-assets', () => ({
  copyEntryRelativeAssets: vi.fn(async () => ({})),
}));

vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  createProxy: vi.fn(({ target }) => target),
}));

vi.mock('$lib/services/contents/editor', () => ({ showDuplicateToast: { current: false } }));

// Loaded transitively, and a `.svelte.js` module compiles differently for the client runtime this
// test uses, so leaving it in would mis-merge its coverage with that of the Node-environment tests
vi.mock('$lib/services/user/env.svelte', () => ({
  env: {},
  initUserEnvDetection: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  LIST_KEY_PATH_REGEX: /\.\d+$/,
  getField: vi.fn(),
  getFieldKind: vi.fn(() => 'builtin'),
  isFieldMultiple: vi.fn(() => false),
}));

const { buildDraft } = await import('.');
const { duplicateDraft } = await import('./duplicate');

const collection = {
  name: 'posts',
  _type: 'entry',
  fields: [
    { name: 'title', widget: 'string' },
    { name: 'blocks', widget: 'list', fields: [{ name: 'body', widget: 'string' }] },
  ],
  _i18n: {
    i18nEnabled: true,
    structureMap: {},
    allLocales: ['_default'],
    initialLocales: ['_default'],
    defaultLocale: '_default',
    canonicalSlug: { key: 'translationKey' },
  },
};

const originalEntry = {
  id: 'entry-1',
  slug: 'hello',
  locales: { _default: { slug: 'hello', content: { title: 'Hello' } } },
};

describe('contents/draft/create: static configuration', () => {
  it('should hand out the very objects the draft was built from', () => {
    const draft = buildDraft({ collection, originalEntry });

    expect(draft.collection).toBe(collection);
    expect(draft.fields).toBe(collection.fields);
    expect(draft.originalEntry).toBe(originalEntry);
  });

  it('should hand out the same objects to every draft built from one collection', () => {
    // Saving an entry with the editor left open rebuilds the draft in place
    expect(buildDraft({ collection, originalEntry }).fields).toBe(
      buildDraft({ collection, originalEntry }).fields,
    );
  });

  it('should keep the configuration static in a duplicated draft', async () => {
    const original = buildDraft({ collection, originalEntry });
    const entryDraft = { current: original };

    await duplicateDraft(entryDraft);

    // The original is static by construction, so the assertions below would hold even if no
    // duplicate had been made — check that the draft was actually replaced first
    expect(entryDraft.current).not.toBe(original);
    expect(entryDraft.current.collection).toBe(collection);
    expect(entryDraft.current.fields).toBe(collection.fields);
  });
});
