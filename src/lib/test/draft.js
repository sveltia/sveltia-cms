import { render } from 'vitest-browser-svelte';

import {
  createEntryDraftMountContext,
  EntryDraftState,
} from '$lib/services/contents/draft/state.svelte';
import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
import { createState } from '$lib/services/utils/state.svelte';

/**
 * @import { Component } from 'svelte';
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalI18nOptions,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Build an entry draft for a component test, with just enough of a collection around it.
 * @param {object} [options] Options.
 * @param {string} [options.collectionName] Collection name.
 * @param {Field[]} [options.fields] Field definitions.
 * @param {Partial<InternalI18nOptions>} [options.i18n] I18n options, merged into the defaults.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent>} [options.values] Flattened values in
 * each locale. Defaults to an empty default locale.
 * @param {Partial<EntryDraft>} [options.draft] Any other draft property.
 * @returns {EntryDraft} Draft, as a deeply reactive `$state`, so a component can mutate it.
 */
export const createMockDraft = ({
  collectionName = 'posts',
  fields = [],
  i18n = {},
  values = undefined,
  draft = {},
} = {}) => {
  const i18nConfig = { ...DEFAULT_I18N_CONFIG, ...i18n };
  const { defaultLocale, allLocales } = i18nConfig;
  const currentValues = values ?? { [defaultLocale]: {} };
  const locales = Object.keys(currentValues);

  const collection = /** @type {InternalCollection} */ (
    /** @type {unknown} */ ({
      name: collectionName,
      label: collectionName,
      folder: `content/${collectionName}`,
      fields,
      _type: 'entry',
      _i18n: i18nConfig,
      _file: { extension: 'md', format: 'frontmatter' },
    })
  );

  /**
   * Build a per-locale map.
   * @template T
   * @param {() => T} getValue Value factory.
   * @returns {Record<InternalLocaleCode, T>} Map.
   */
  const perLocale = (getValue) => Object.fromEntries(locales.map((locale) => [locale, getValue()]));

  return createState(
    /** @type {EntryDraft} */ ({
      id: 'draft',
      createdAt: 0,
      isNew: true,
      isIndexFile: false,
      canPreview: true,
      collectionName,
      collection,
      fields,
      defaultLocale,
      originalLocales: Object.fromEntries(allLocales.map((locale) => [locale, true])),
      currentLocales: Object.fromEntries(allLocales.map((locale) => [locale, true])),
      originalSlugs: {},
      currentSlugs: {},
      originalValues: structuredClone(currentValues),
      currentValues,
      extraValues: perLocale(() => ({})),
      files: {},
      validities: perLocale(() => ({})),
      validationMessages: perLocale(() => ({})),
      // The expander states are shared by the locales
      expanderStates: { _: {} },
      slugEditor: {},
      interacted: false,
      pendingEntries: [],
      ...draft,
    }),
  );
};

/**
 * Render a component that reads the entry draft from the Svelte context, e.g. a field editor or
 * preview.
 * @param {Component<any>} Component Component.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Draft, usually from {@link createMockDraft}.
 * @param {Record<string, any>} [args.props] Component props.
 * @param {Record<string, any>} [args.context] Any other Svelte context, keyed by context key, e.g.
 * the `field-editor` context a field editor gets from its parent.
 * @returns {Promise<Awaited<ReturnType<typeof render>> & { entryDraft: EntryDraftState }>}
 * Render result along with the draft state, whose `current` can be replaced to test a draft change.
 */
export const renderWithDraft = async (Component, { draft, props = {}, context = {} }) => {
  const entryDraft = new EntryDraftState();

  entryDraft.current = draft;

  const contextMap = createEntryDraftMountContext(entryDraft);

  Object.entries(context).forEach(([key, value]) => {
    contextMap.set(key, value);
  });

  const result = await render(Component, { context: contextMap, props });

  return { ...result, entryDraft };
};
