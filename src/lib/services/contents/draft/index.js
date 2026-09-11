import { stripSlashes } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';

/**
 * Regex to match internal properties added to list items, which should be excluded from output.
 */
export const INTERNAL_PROP_REGEX = /\.__sc_\w+$/;

/**
 * @import { EntryDraft, FlattenedEntryContent, LocaleContentMap } from '$lib/types/private';
 */

/**
 * Nesting depth of the {@link suspendAutoDuplication} calls currently in flight.
 */
let autoDupSuspendDepth = 0;

/**
 * Whether the automatic i18n duplication in the draft value proxies is currently enabled. It’s
 * temporarily disabled for performance reasons when making large changes to the values. Use
 * {@link suspendAutoDuplication} to disable it.
 * @returns {boolean} Result.
 */
export const isAutoDuplicationEnabled = () => !autoDupSuspendDepth;

/**
 * Run the given function with the automatic i18n duplication in the draft value proxies suspended.
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

  /**
   * Release this suspension, re-enabling the duplication if it was the outermost one.
   */
  const release = () => {
    autoDupSuspendDepth -= 1;
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
 * Revoke the blob URLs of the given outgoing draft’s unsaved files.
 *
 * Each of these URLs keeps its entire file in memory until it’s revoked, and nothing else releases
 * them: the URL is the field value for the duration of the editing session, and is swapped for the
 * real file path when the entry is saved. Once the draft is replaced, the URLs are unreachable but
 * still registered with the browser, so every image attached in the editor would stay in memory
 * until the page is reloaded. A restored backup regenerates its URLs from the stored files, so
 * discarding them here doesn’t break that.
 * @param {EntryDraft | null | undefined} draft The outgoing draft, if any.
 */
export const revokeDraftFileURLs = (draft) => {
  Object.keys(draft?.files ?? {}).forEach((blobURL) => {
    URL.revokeObjectURL(blobURL);
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
 * Check whether a value map key holds content that the comparison below has to look at. Internal
 * properties are bookkeeping rather than content. An `undefined` value is left out as well: it’s
 * empty when the entry is written, so it makes no difference to the saved file whether the key is
 * there, and a key holding one can’t always be reproduced — reverting a field assigns the original
 * `undefined` back to a property that was just deleted, which leaves a state proxy without the key.
 * @param {FlattenedEntryContent} valueMap Value map to look in.
 * @param {string} key Key to check.
 * @returns {boolean} Whether the key counts.
 */
const isRealKey = (valueMap, key) => !INTERNAL_PROP_REGEX.test(key) && valueMap[key] !== undefined;

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
    if (!isRealKey(currentValueMap, key)) {
      return false;
    }

    realKeyCount += 1;

    return (
      !Object.hasOwn(originalValueMap, key) || !equal(originalValueMap[key], currentValueMap[key])
    );
  });

  // Also catch keys that only exist in the original map, which the loop above cannot see
  return (
    anyValueChanged ||
    Object.keys(originalValueMap).filter((key) => isRealKey(originalValueMap, key)).length !==
      realKeyCount
  );
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
 * Check whether the given entry draft has been modified.
 *
 * Called from a `$derived`, this is recomputed whenever any of the compared values changes — so on
 * every keystroke in the editor — hence the hand-rolled value comparison instead of deep-comparing
 * a filtered copy of the whole content.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Whether the draft has been modified. `false` if there is no draft.
 */
export const isDraftModified = (draft) => {
  if (!draft) {
    return false;
  }

  const {
    originalLocales,
    currentLocales,
    originalSlugs,
    currentSlugs,
    originalPath,
    currentPath,
    originalValues,
    currentValues,
  } = draft;

  return (
    !equal(originalLocales, currentLocales) ||
    !equal(originalSlugs, currentSlugs) ||
    // Moving an entry with the path editor is a change of its own, with no field to go with it
    stripSlashes(originalPath ?? '') !== stripSlashes(currentPath ?? '') ||
    // Internal properties are excluded from the value comparison
    areValuesModified(originalValues, currentValues)
  );
};
