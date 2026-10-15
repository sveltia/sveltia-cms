import equal from 'fast-deep-equal';

import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { saveChanges } from '$lib/services/backends/save';
import { isConfigReadonly } from '$lib/services/config/readonly';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import { validateAnyField } from '$lib/services/contents/draft/validate/fields';
import { getFieldValidationMessages } from '$lib/services/contents/draft/validate/messages';
import { isUniqueField, normalizeUniqueValue } from '$lib/services/contents/draft/validate/unique';
import { finalizeValidity } from '$lib/services/contents/draft/validate/validity';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
} from '$lib/services/contents/entry/changes';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { getOrCreate } from '$lib/services/utils/cache';
import { isValueEmpty } from '$lib/services/utils/object';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

/**
 * @import {
 * Entry,
 * EntryDraft,
 * FileChange,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Pending edits made in the bulk editor, keyed by entry ID, then by field name. Only the values
 * that differ from the stored ones are kept.
 * @typedef {Record<string, Record<FieldKeyPath, any>>} BulkEdits
 */

/**
 * Validation messages of the pending edits, keyed by entry ID, then by field name. Only the fields
 * with an error are listed.
 * @typedef {Record<string, Record<FieldKeyPath, string[]>>} BulkEditErrors
 */

/**
 * Check whether an entry can be edited in the bulk editor. The collection’s index file, which may
 * have fields of its own, an entry without content in the default locale and an entry locked by
 * the `readonly` option are left out.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 */
export const isBulkEditableEntry = (collection, entry) =>
  !!entry.locales[collection._i18n.defaultLocale]?.content &&
  !isCollectionIndexFile(collection, entry) &&
  !isEntryReadonly(entry);

/**
 * Get the stored value of a field in the default locale of an entry.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {Entry} entry Entry.
 * @param {FieldKeyPath} keyPath Field name.
 * @returns {any} Value.
 */
export const getStoredValue = (collection, entry, keyPath) =>
  entry.locales[collection._i18n.defaultLocale]?.content[keyPath];

/**
 * Get the value of a field as it is shown in the bulk editor: the pending edit if any, or else the
 * stored value.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry.
 * @param {FieldKeyPath} args.keyPath Field name.
 * @param {BulkEdits} args.edits Pending edits.
 * @returns {any} Value.
 */
export const getBulkEditValue = ({ collection, entry, keyPath, edits }) => {
  const entryEdits = edits[entry.id];

  return entryEdits && Object.hasOwn(entryEdits, keyPath)
    ? entryEdits[keyPath]
    : getStoredValue(collection, entry, keyPath);
};

/**
 * Check whether two field values mean the same thing to the bulk editor. A missing value and an
 * empty one are the same, so clearing a field that has no value isn’t a change.
 * @param {any} a Value.
 * @param {any} b Another value.
 * @returns {boolean} Result.
 */
const isSameValue = (a, b) => {
  /**
   * Normalize an empty value.
   * @param {any} value Value.
   * @returns {any} Normalized value.
   */
  const normalize = (value) => (isValueEmpty(value) ? '' : value);

  return equal(normalize(a), normalize(b));
};

/**
 * Record an edit made in the bulk editor, returning the updated edits. An edit that brings the
 * value back to the stored one is dropped, so the entry isn’t counted as changed.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry.
 * @param {FieldKeyPath} args.keyPath Field name.
 * @param {any} args.value New value.
 * @param {BulkEdits} args.edits Current edits, which are not modified.
 * @returns {BulkEdits} Updated edits.
 */
export const setBulkEditValue = ({ collection, entry, keyPath, value, edits }) => {
  const { [keyPath]: _previous, ...otherFieldEdits } = edits[entry.id] ?? {};
  const { [entry.id]: _entryEdits, ...otherEntryEdits } = edits;
  const storedValue = getStoredValue(collection, entry, keyPath);
  const fieldConfig = collection.fields.find(({ name }) => name === keyPath);
  // A Boolean field without a value is shown as off, so turning it off isn’t a change
  const shownValue = fieldConfig?.widget === 'boolean' ? (storedValue ?? false) : storedValue;

  const entryEdits = isSameValue(value, shownValue)
    ? otherFieldEdits
    : { ...otherFieldEdits, [keyPath]: value };

  return Object.keys(entryEdits).length
    ? { ...otherEntryEdits, [entry.id]: entryEdits }
    : otherEntryEdits;
};

/**
 * Count the fields with a pending edit.
 * @param {BulkEdits} edits Pending edits.
 * @returns {number} Count.
 */
export const countBulkEdits = (edits) =>
  Object.values(edits).reduce((count, entryEdits) => count + Object.keys(entryEdits).length, 0);

/**
 * Apply the pending edits to a copy of an entry. A field with the `duplicate` i18n option gets the
 * same value in every locale that has content, as it does in the entry editor; any other field is
 * only changed in the default locale. The DateTime fields with the `auto_now` option are updated
 * too, as a save in the entry editor would.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry, which is not modified.
 * @param {Record<FieldKeyPath, any>} args.entryEdits Pending edits of the entry.
 * @returns {Entry} Updated entry.
 */
export const applyBulkEdits = ({ collection, entry, entryEdits }) => {
  const { defaultLocale } = collection._i18n;

  /** @type {Record<string, Record<string, any>>} */
  const currentValues = Object.fromEntries(
    Object.entries(entry.locales)
      .filter(([, { content }]) => !!content)
      .map(([locale, { content }]) => [locale, { ...content }]),
  );

  Object.entries(entryEdits).forEach(([keyPath, value]) => {
    const fieldConfig = collection.fields.find(({ name }) => name === keyPath);

    Object.entries(currentValues).forEach(([locale, content]) => {
      if (locale === defaultLocale || fieldConfig?.i18n === 'duplicate') {
        content[keyPath] = value;
      }
    });
  });

  assignAutoNowValues(
    /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({
        isNew: false,
        collectionName: collection.name,
        isIndexFile: false,
        currentValues,
      })
    ),
  );

  return {
    ...entry,
    locales: Object.fromEntries(
      Object.entries(entry.locales).map(([locale, localizedEntry]) => [
        locale,
        currentValues[locale]
          ? { ...localizedEntry, content: currentValues[locale] }
          : { ...localizedEntry },
      ]),
    ),
  };
};

/**
 * Find the values of the unique fields that the pending edits would leave in more than one entry,
 * looking at the collection as it would be once the edits are saved. Unlike the check done in the
 * entry editor, this takes the other pending edits into account, so two entries swapping their
 * values isn’t reported, while two entries given the same new value are.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {FieldKeyPath} args.keyPath Field name.
 * @param {string} args.fieldType Field type.
 * @param {BulkEdits} args.edits Pending edits.
 * @returns {Map<string | number, number>} Number of entries holding each normalized value.
 */
const countUniqueValues = ({ collection, keyPath, fieldType, edits }) => {
  /** @type {Map<string | number, number>} */
  const counts = new Map();

  const published = getEntriesByCollection(collection.name).filter(
    (entry) => !isCollectionIndexFile(collection, entry),
  );

  const publishedPaths = new Set(published.flatMap((entry) => getEntryPaths(entry)));

  // An unpublished version of a published entry is another version of the same entry, not another
  // entry, so it’s left out; it’s told by its paths, including the ones it had before a rename. An
  // entry that has never been published is another entry. Entries stored in one file share a path,
  // but such a collection can’t use the Editorial Workflow, so none of them is unpublished
  const unpublished = getUnpublishedEntriesByCollection(collection.name).filter(
    (entry) =>
      !isCollectionIndexFile(collection, entry) &&
      !getEntryPaths(entry, { includePrevious: true }).some((path) => publishedPaths.has(path)),
  );

  [...published, ...unpublished].forEach((entry) => {
    const value = normalizeUniqueValue(
      getBulkEditValue({ collection, entry, keyPath, edits }),
      fieldType,
    );

    if (value !== undefined) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  return counts;
};

/**
 * Validate the pending edits against the field configuration, the way a save in the entry editor
 * would. Only the edited fields are checked, so an entry that was already invalid can still have
 * another field changed.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry[]} args.entries Entries shown in the bulk editor.
 * @param {BulkEdits} args.edits Pending edits.
 * @returns {BulkEditErrors} Validation messages of the invalid fields.
 */
export const validateBulkEdits = ({ collection, entries, edits }) => {
  const { defaultLocale } = collection._i18n;
  const draft = createSyntheticDraft({ collection });
  /** @type {Map<FieldKeyPath, Map<string | number, number>>} */
  const uniqueValueCounts = new Map();
  /** @type {BulkEditErrors} */
  const errors = {};

  entries.forEach((entry) => {
    const entryEdits = edits[entry.id];

    if (!entryEdits) {
      return;
    }

    const content = { ...entry.locales[defaultLocale]?.content, ...entryEdits };

    Object.entries(entryEdits).forEach(([keyPath, value]) => {
      const fieldConfig = /** @type {Field} */ (
        collection.fields.find(({ name }) => name === keyPath)
      );

      let validity = validateAnyField({
        draft: { ...draft, originalEntry: entry },
        locale: defaultLocale,
        keyPath,
        value,
        valueMap: content,
        validities: { [defaultLocale]: {} },
      });

      // The validator compares a unique value with the other entries as they are stored, which
      // doesn’t account for the other pending edits, so the check is made again across the batch
      if (validity && isUniqueField({ draft, fieldConfig, keyPath })) {
        const fieldType = fieldConfig.widget ?? 'string';
        const normalized = normalizeUniqueValue(value, fieldType);

        const valueCounts = getOrCreate(uniqueValueCounts, keyPath, () =>
          countUniqueValues({ collection, keyPath, fieldType, edits }),
        );

        const updated = { ...validity };

        delete updated.valid;
        updated.duplicateError =
          normalized !== undefined && /** @type {number} */ (valueCounts.get(normalized)) > 1;
        validity = finalizeValidity(updated);
      }

      if (validity && !validity.valid) {
        errors[entry.id] = {
          ...errors[entry.id],
          [keyPath]: getFieldValidationMessages({ validity, fieldConfig }),
        };
      }
    });
  });

  return errors;
};

/**
 * Build the {@link FileChange}s that save the pending edits, one or more per edited entry. The
 * edits are applied to each entry as it is in the store now rather than as it was when the editor
 * was opened, so a change someone else has made to another field of the entry in the meantime isn’t
 * reverted. An entry deleted in the meantime is left out.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry[]} args.entries Entries shown in the bulk editor.
 * @param {BulkEdits} args.edits Pending edits.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
export const buildBulkEditChanges = async ({ collection, entries, edits }) => {
  // A fetch carries an entry’s ID over to its changed version
  const currentEntries = new Map(
    getEntriesByCollection(collection.name).map((entry) => [entry.id, entry]),
  );

  const savingEntries = entries
    .filter((entry) => !!edits[entry.id] && currentEntries.has(entry.id))
    .map((entry) =>
      applyBulkEdits({
        collection,
        entry: /** @type {Entry} */ (currentEntries.get(entry.id)),
        entryEdits: edits[entry.id],
      }),
    );

  const draft = createSyntheticDraft({ collection });
  const cacheDB = resolveCacheDB();

  const perEntryChanges = await Promise.all(
    savingEntries.map((entry) => buildEntryUpdateChanges({ collection, entry, draft, cacheDB })),
  );

  return { changes: perEntryChanges.flat(), savingEntries };
};

/**
 * Save the pending edits made in the bulk editor in a single commit.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry[]} args.entries Entries shown in the bulk editor.
 * @param {BulkEdits} args.edits Pending edits.
 * @returns {Promise<number>} Number of entries saved.
 */
export const saveBulkEdits = async ({ collection, entries, edits }) => {
  // The collection could have been made read-only since the editor was opened, e.g. by a
  // configuration reload, in which case nothing is written
  if (isConfigReadonly({ collection })) {
    return 0;
  }

  // Bring the store up to date first, so the edits are applied to the entries as they are now. The
  // check is a nicety: if it fails, the backend still has the last word on the commit
  try {
    await checkForRemoteChanges();
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to check the repository for changes.', ex);
  }

  const { changes, savingEntries } = await buildBulkEditChanges({ collection, entries, edits });

  if (!changes.length) {
    return 0;
  }

  await saveChanges({
    changes,
    savingEntries,
    options: { commitType: 'update', collection },
  });

  contentUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    count: savingEntries.length,
  };

  return savingEntries.length;
};
