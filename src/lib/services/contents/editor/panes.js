import { _ } from '@sveltia/i18n';
import { untrack } from 'svelte';

import { MIN_PANE_SIZE } from '$lib/services/contents/editor';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { getLocaleLabel } from '$lib/services/contents/i18n';
import { DEFAULT_LOCALE_KEY } from '$lib/services/contents/i18n/config/constants';

/**
 * @import { EntryEditorPane, InternalCollection, InternalCollectionFile, InternalLocaleCode }
 * from '$lib/types/private';
 */

/**
 * I18n keys of the strings naming a locale’s content in the editor, e.g. “Edit English Content”,
 * mapped to the keys of the same strings without the locale, for the content of a monolingual
 * entry, e.g. “Edit Content”.
 */
const LOCALE_CONTENT_KEYS = {
  edit_x_locale: 'edit_content',
  preview_x_locale: 'preview_content',
  show_content_options_x_locale: 'show_content_options',
  content_options_x_locale: 'content_options',
};

/**
 * Localize a string naming a locale’s content in the editor. The content of a monolingual entry
 * has no locale to name, so the string without it is used rather than the internal locale key.
 * @param {keyof LOCALE_CONTENT_KEYS} key I18n key of the string with the locale.
 * @param {InternalLocaleCode} locale Locale code.
 * @returns {string} Localized string.
 */
export const getLocaleContentLabel = (key, locale) =>
  locale === DEFAULT_LOCALE_KEY
    ? _(LOCALE_CONTENT_KEYS[key])
    : _(key, { values: { locale: getLocaleLabel(locale) ?? locale } });

/**
 * Get the key under which the pane state of the given collection or collection file is saved.
 * @param {object} args Arguments.
 * @param {InternalCollection} [args.collection] Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, if any.
 * @returns {string | undefined} Key, or `undefined` without a collection.
 */
export const getPaneStateKey = ({ collection, collectionFile }) =>
  collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name;

/**
 * Get the sizes of the editor panes, in percent. The saved widths are used when both panes are
 * shown and the widths are sound; otherwise the panes are split evenly, or a lone pane takes it
 * all.
 * @param {object} args Arguments.
 * @param {?EntryEditorPane} args.firstPane First pane.
 * @param {?EntryEditorPane} args.secondPane Second pane.
 * @returns {[number, number, number]} Sizes of the first and second panes, and the minimum size
 * of a pane, which is `0` when a pane can’t be resized.
 */
export const getPaneSizes = ({ firstPane, secondPane }) => {
  if (!firstPane && !secondPane) {
    return [0, 0, 0];
  }

  if (!firstPane || !secondPane) {
    return [firstPane ? 100 : 0, secondPane ? 100 : 0, 0];
  }

  if (
    typeof firstPane.width === 'number' &&
    typeof secondPane.width === 'number' &&
    firstPane.width >= MIN_PANE_SIZE &&
    secondPane.width >= MIN_PANE_SIZE &&
    firstPane.width + secondPane.width === 100
  ) {
    return [firstPane.width, secondPane.width, MIN_PANE_SIZE];
  }

  return [50, 50, MIN_PANE_SIZE];
};

/**
 * Work out the panes to restore for an entry: the saved state of its collection, or the locale
 * given in the URL. Nothing is restored when the saved state doesn’t fit the entry, e.g. a locale
 * that it doesn’t have, or a preview pane while the preview is disabled.
 * @param {object} args Arguments.
 * @param {[?EntryEditorPane, ?EntryEditorPane]} [args.savedPanes] Saved pane state.
 * @param {string} [args.editorLocale] Locale given in the URL, which overrides the saved state.
 * @param {InternalLocaleCode[]} args.allLocales Locales of the entry.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry.
 * @param {boolean} args.canPreview Whether the entry has a preview.
 * @param {boolean} [args.showPreview] Whether the user wants the preview pane.
 * @param {boolean} args.showSecondPane Whether the user wants the second pane.
 * @returns {[EntryEditorPane, EntryEditorPane] | undefined} Panes to restore, or `undefined` if
 * nothing can be restored.
 */
export const getRestoredPanes = ({
  savedPanes = [null, null],
  editorLocale,
  allLocales,
  defaultLocale,
  canPreview,
  showPreview,
  showSecondPane,
}) => {
  /** @type {[?EntryEditorPane, ?EntryEditorPane]} */
  const [firstPane, secondPane] = editorLocale
    ? [
        { mode: 'edit', locale: editorLocale },
        { mode: 'preview', locale: editorLocale },
      ]
    : savedPanes;

  if (
    !firstPane ||
    !secondPane ||
    (!!firstPane.locale && !allLocales.includes(firstPane.locale)) ||
    (!!secondPane.locale && !allLocales.includes(secondPane.locale)) ||
    !showSecondPane ||
    ((!showPreview || !canPreview) &&
      (firstPane.mode === 'preview' || secondPane.mode === 'preview')) ||
    // If there are only 2 locales and the first pane is not in the default locale, don’t restore
    // the panes so that the default locale is always shown in the first pane
    (allLocales.length === 2 && firstPane.locale !== defaultLocale)
  ) {
    return undefined;
  }

  return [firstPane, secondPane];
};

/**
 * Work out the default panes for an entry, when nothing is restored: the first pane edits the
 * current or default locale, and the second one holds the preview, or another locale when there’s
 * no preview to show, or nothing at all when there’s no room for it.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} [args.currentLocale] Locale of the current first pane, if any.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry.
 * @param {InternalLocaleCode[]} args.allLocales Locales of the entry.
 * @param {boolean} args.i18nEnabled Whether the entry has more than one locale.
 * @param {boolean} args.canPreview Whether the entry has a preview.
 * @param {boolean} [args.showPreview] Whether the user wants the preview pane.
 * @param {boolean} args.showSecondPane Whether the user wants the second pane.
 * @param {boolean} args.singlePane Whether the screen only has room for one pane.
 * @returns {[EntryEditorPane, ?EntryEditorPane]} Panes.
 */
export const getDefaultPanes = ({
  currentLocale,
  defaultLocale,
  allLocales,
  i18nEnabled,
  canPreview,
  showPreview,
  showSecondPane,
  singlePane,
}) => {
  const locale = currentLocale ?? defaultLocale;
  /** @type {EntryEditorPane} */
  const firstPane = { mode: 'edit', locale };

  if (singlePane || !showSecondPane) {
    return [firstPane, null];
  }

  if (!showPreview || !canPreview) {
    const otherLocale = i18nEnabled ? allLocales.find((l) => l !== locale) : undefined;

    return [firstPane, otherLocale ? { mode: 'edit', locale: otherLocale } : null];
  }

  return [firstPane, { mode: 'preview', locale }];
};

/**
 * Work out the panes that show the given locale’s edit pane. A preview pane is switched to edit
 * mode by preference; otherwise the second pane is repurposed, or the only pane in a single-pane
 * layout.
 * @param {object} args Arguments.
 * @param {?EntryEditorPane} args.firstPane First pane.
 * @param {?EntryEditorPane} args.secondPane Second pane.
 * @param {InternalLocaleCode} args.locale Locale to edit.
 * @returns {[?EntryEditorPane, ?EntryEditorPane] | undefined} New panes, or `undefined` if the
 * locale is already being edited in a pane.
 */
export const getPanesEditingLocale = ({ firstPane, secondPane, locale }) => {
  /** @type {EntryEditorPane} */
  const editPane = { mode: 'edit', locale };

  if (
    (firstPane?.mode === 'edit' && firstPane.locale === locale) ||
    (secondPane?.mode === 'edit' && secondPane.locale === locale)
  ) {
    return undefined;
  }

  if (secondPane?.mode === 'preview') {
    return [firstPane, editPane];
  }

  if (firstPane?.mode === 'preview') {
    return [editPane, secondPane];
  }

  if (secondPane) {
    // Both are edit panes for other locales; switch the second one
    return [firstPane, editPane];
  }

  // Single-pane layout
  return [editPane, secondPane];
};

/**
 * Save the pane state of a collection to the editor settings, so it’s restored the next time an
 * entry of the collection is opened.
 * @param {string} key Key from {@link getPaneStateKey}.
 * @param {[EntryEditorPane, EntryEditorPane]} panes Panes.
 */
export const savePaneState = (key, panes) => {
  // Don’t track the settings being updated, as this is called from an effect
  const settings = untrack(() => entryEditorSettings.current);

  entryEditorSettings.current = {
    ...settings,
    paneStates: { ...settings?.paneStates, [key]: panes },
  };
};
