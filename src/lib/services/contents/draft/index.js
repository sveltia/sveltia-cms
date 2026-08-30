import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * Regex to match internal properties added to list items, which should be excluded from output.
 */
export const INTERNAL_PROP_REGEX = /\.__sc_\w+$/;

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { EntryDraft, FlattenedEntryContent, LocaleContentMap } from '$lib/types/private';
 */

/**
 * @type {Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();

/**
 * Whether to enable automatic i18n duplication in proxies in {@link entryDraft}. This can be
 * temporarily disabled for performance reasons when making large changes to the values. Use
 * {@link suspendAutoDuplication} rather than writing to this store directly.
 */
export const i18nAutoDupEnabled = writable(true);

/**
 * Nesting depth of the {@link suspendAutoDuplication} calls currently in flight.
 */
let autoDupSuspendDepth = 0;

/**
 * Run the given function with the automatic i18n duplication in {@link entryDraft} suspended.
 *
 * A caller that writes a `duplicate` field to every locale itself has to stop the proxy from
 * duplicating the same value again. Suspensions nest — the proxy is re-enabled only once the
 * outermost one finishes — so a caller doesn’t have to know whether anything it calls suspends
 * too. The suspension is released even if the function throws.
 * @param {() => any} fn Function to run. If it returns a promise, the suspension is held until that
 * promise settles.
 * @returns {any} Whatever `fn` returns.
 * @throws {Error} Whatever `fn` throws, after releasing the suspension.
 */
export const suspendAutoDuplication = (fn) => {
  autoDupSuspendDepth += 1;
  i18nAutoDupEnabled.set(false);

  /**
   * Release this suspension, re-enabling the duplication if it was the outermost one.
   */
  const release = () => {
    autoDupSuspendDepth -= 1;

    if (!autoDupSuspendDepth) {
      i18nAutoDupEnabled.set(true);
    }
  };

  /** @type {any} */
  let result;

  try {
    result = fn();
  } catch (ex) {
    release();
    throw ex;
  }

  if (result instanceof Promise) {
    return result.finally(release);
  }

  release();

  return result;
};

/**
 * Whether the user has manually interacted with the entry editor. This prevents auto-backup from
 * triggering when only programmatic changes (e.g. Lexical markdown reformatting) have occurred.
 */
export const entryDraftInteracted = writable(false);

/**
 * Revoke the blob URLs of the current draft’s unsaved files, except those the incoming draft still
 * refers to.
 *
 * Each of these URLs keeps its entire file in memory until it’s revoked, and nothing else releases
 * them: the URL is the field value for the duration of the editing session, and is swapped for the
 * real file path when the entry is saved. Once the draft is replaced, the URLs are unreachable but
 * still registered with the browser, so every image attached in the editor would stay in memory
 * until the page is reloaded. A restored backup regenerates its URLs from the stored files, so
 * discarding them here doesn’t break that.
 * @param {Record<string, any>} [nextFiles] The incoming draft’s file map. Duplicating an entry
 * carries the same map over, and those URLs are still displayed, so they must be kept.
 */
export const revokeDraftFileURLs = (nextFiles = {}) => {
  const { files } = get(entryDraft) ?? {};

  Object.keys(files ?? {}).forEach((blobURL) => {
    if (!(blobURL in nextFiles)) {
      URL.revokeObjectURL(blobURL);
    }
  });
};

/**
 * Filter out internal properties from a value map.
 * @param {FlattenedEntryContent} valueMap The value map to filter.
 * @returns {FlattenedEntryContent} The filtered value map.
 */
export const filterRealValues = (valueMap) =>
  Object.fromEntries(Object.entries(valueMap).filter(([key]) => !INTERNAL_PROP_REGEX.test(key)));

/**
 * Compare a locale’s original and current value maps, ignoring internal properties in the current
 * one. Equivalent to deep-comparing {@link filterRealValues} of the current map against the
 * original, but without building the filtered copy first.
 * @param {FlattenedEntryContent} originalValueMap Original values for the locale.
 * @param {FlattenedEntryContent} currentValueMap Current values for the locale.
 * @returns {boolean} Whether the values differ.
 */
const isValueMapModified = (originalValueMap, currentValueMap) => {
  let realKeyCount = 0;

  const anyValueChanged = Object.keys(currentValueMap).some((key) => {
    if (INTERNAL_PROP_REGEX.test(key)) {
      return false;
    }

    realKeyCount += 1;

    return (
      !Object.hasOwn(originalValueMap, key) || !equal(originalValueMap[key], currentValueMap[key])
    );
  });

  // Also catch keys that only exist in the original map, which the loop above cannot see
  return anyValueChanged || Object.keys(originalValueMap).length !== realKeyCount;
};

/**
 * Compare the original and current values of every locale in the draft.
 * @param {LocaleContentMap} originalValues Original values.
 * @param {LocaleContentMap} currentValues Current values.
 * @returns {boolean} Whether the values differ.
 */
const areValuesModified = (originalValues, currentValues) => {
  const currentLocales = Object.keys(currentValues);

  if (currentLocales.length !== Object.keys(originalValues).length) {
    return true;
  }

  return currentLocales.some((locale) => {
    const originalValueMap = originalValues[locale];

    return !originalValueMap || isValueMapModified(originalValueMap, currentValues[locale]);
  });
};

/**
 * Whether the current {@link entryDraft} has been modified.
 *
 * This is recomputed on every draft update — so on every keystroke in the editor — hence the
 * hand-rolled value comparison instead of deep-comparing a filtered copy of the whole content.
 * @type {Readable<boolean>}
 */
export const entryDraftModified = derived([entryDraft], ([draft]) => {
  if (!draft) {
    return false;
  }

  const {
    originalLocales,
    currentLocales,
    originalSlugs,
    currentSlugs,
    originalValues,
    currentValues,
  } = draft;

  return (
    !equal(originalLocales, currentLocales) ||
    !equal(originalSlugs, currentSlugs) ||
    // Internal properties are excluded from the value comparison
    areValuesModified(originalValues, currentValues)
  );
});

entryDraft.subscribe((draft) => {
  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
