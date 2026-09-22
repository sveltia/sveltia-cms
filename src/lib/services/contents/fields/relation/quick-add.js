import { unique } from '@sveltia/utils/array';

import { getCollection } from '$lib/services/contents/collection';
import {
  countCollectionEntries,
  getEntriesByCollection,
} from '$lib/services/contents/collection/entries';
import { getReferencedPendingEntries } from '$lib/services/contents/draft/pending-entries';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getCanonicalSlug, getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { updateListField } from '$lib/services/contents/draft/update/list';
import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { getEntryOptions } from '$lib/services/contents/fields/relation/helpers';
import { renameIfNeeded } from '$lib/services/utils/file';
import { isWorkflowDraft, isWorkflowEnabled } from '$lib/services/workflow';

/**
 * @import {
 * DraftValueStoreKey,
 * Entry,
 * EntryDraft,
 * EntrySlugVariants,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * PendingEntry,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * Get the pending entries of the given draft that belong to the given collection.
 * @param {EntryDraft} draft Draft being edited.
 * @param {string} collectionName Collection name.
 * @returns {PendingEntry[]} Pending entries.
 */
const getPendingEntriesByCollection = (draft, collectionName) =>
  draft.pendingEntries.filter((pendingEntry) => pendingEntry.collectionName === collectionName);

/**
 * Get the collection a Relation field can have a new entry created in, so the entry can be
 * referenced right away. That’s the referenced collection, provided it holds entries that can be
 * created: a file/singleton collection has a fixed set of files, and a reference to one of them
 * points at a list item within the file, so there is nothing to create there.
 *
 * Nothing is offered while the entry being edited is saved through Editorial Workflow: the new
 * entry would go into the pull request along with it, but a pull request stands for a single entry
 * in the workflow, so the new one would be invisible until the pull request is published. Nor is
 * anything offered when the referenced collection itself is under the workflow, as the new entry
 * would be committed along with the entry being edited, skipping the review the collection asks
 * for.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {EntryDraft} args.draft Draft being edited.
 * @returns {InternalEntryCollection | undefined} Collection, or `undefined` if entries can’t be
 * created for the field.
 */
export const getCreatableCollection = ({
  fieldConfig: { collection: collectionName, file: fileName },
  draft,
}) => {
  if (fileName || isWorkflowDraft(draft)) {
    return undefined;
  }

  const collection = getCollection(collectionName);

  if (
    collection?._type !== 'entry' ||
    collection.create === false ||
    isWorkflowEnabled(collection)
  ) {
    return undefined;
  }

  return collection;
};

/**
 * Check whether the collection’s entry quota leaves room for another entry, counting the entries
 * already added from the draft, which aren’t in the collection yet.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection to create an entry in.
 * @param {EntryDraft} args.draft Draft being edited.
 * @returns {boolean} Whether an entry can be added.
 */
export const hasCreationRoom = ({ collection, draft }) => {
  const { name, limit = Infinity } = collection;

  // The collection’s index file is its own page rather than one of the entries in it, so it doesn’t
  // take up a slot — see `countCollectionEntries()`
  return (
    countCollectionEntries(name, getEntriesByCollection(name)) +
      getPendingEntriesByCollection(draft, name).length <
    limit
  );
};

/**
 * Get the pending entries of the draft that the given Relation field can refer to, in the shape of
 * the entries the field is offered otherwise.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Draft being edited.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Entries the field refers to otherwise. A pending entry that is
 * among them is left out: once the draft is saved, the entries land in the collection a moment
 * before the draft goes away, and the field would offer each of them twice meanwhile.
 * @returns {Entry[]} Entries.
 */
export const getPendingRefEntries = ({
  draft,
  fieldConfig: { collection: collectionName },
  refEntries,
}) => {
  if (!draft) {
    return [];
  }

  const refEntryIds = new Set(refEntries.map(({ id }) => id));

  return getPendingEntriesByCollection(draft, collectionName)
    .map(({ entry }) => entry)
    .filter(({ id }) => !refEntryIds.has(id));
};

/**
 * Determine the slugs of an entry to be added to the draft. The slug is made unique among the
 * entries in the collection, but the entries pending on the draft aren’t there yet, so a second
 * entry added with the same title would get the same slug — and overwrite the first one on save.
 * The default locale’s slug is renamed if it’s taken by a pending entry, along with the slugs that
 * derive from it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry to be added.
 * @param {EntryDraft} args.parentDraft Draft being edited, holding the pending entries.
 * @returns {EntrySlugVariants} Slugs.
 */
export const getPendingEntrySlugs = ({ draft, parentDraft }) => {
  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug, localizedSlugs } = slugs;

  const pendingSlugs = getPendingEntriesByCollection(parentDraft, draft.collectionName).map(
    ({ entry }) => entry.slug,
  );

  const renamedSlug = renameIfNeeded(defaultLocaleSlug, pendingSlugs);

  if (renamedSlug === defaultLocaleSlug) {
    return slugs;
  }

  const renamedLocalizedSlugs = localizedSlugs
    ? { ...localizedSlugs, [draft.defaultLocale]: renamedSlug }
    : undefined;

  return {
    defaultLocaleSlug: renamedSlug,
    localizedSlugs: renamedLocalizedSlugs,
    canonicalSlug: getCanonicalSlug({
      draft,
      defaultLocaleSlug: renamedSlug,
      localizedSlugs: renamedLocalizedSlugs,
      fillSlugOptions: getFillSlugOptions({ draft }),
    }),
  };
};

/**
 * Turn the draft of a new entry into a pending entry of the draft being edited: the entry is
 * prepared for saving the same way any entry is, and the file changes are held on the parent draft
 * until that one is saved. The draft of the new entry has to be valid; the caller checks that, as
 * it also reports the errors.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry to be added.
 * @param {EntryDraft} args.parentDraft Draft being edited.
 * @param {RelationField} args.fieldConfig Configuration of the Relation field the entry is added
 * from, which decides the values the entry goes by.
 * @returns {Promise<PendingEntry>} Pending entry.
 */
export const createPendingEntry = async ({ draft, parentDraft, fieldConfig }) => {
  const { collectionName } = draft;

  // Each entry added takes the next order, the same way an entry saved on its own would
  assignManualSortOrder(draft, getPendingEntriesByCollection(parentDraft, collectionName).length);

  const slugs = getPendingEntrySlugs({ draft, parentDraft });
  const { savingEntry, changes, savingAssets } = await createSavingEntryData({ draft, slugs });
  // The value can be localized, e.g. `{{locale}}/{{slug}}`, so collect it for every locale the
  // parent entry has
  const { pendingEntries } = parentDraft;

  const values = unique(
    Object.keys(parentDraft.currentValues).flatMap((locale) =>
      getEntryOptions({ locale, fieldConfig, refEntry: savingEntry, pendingEntries }).map(
        ({ value }) => value,
      ),
    ),
  );

  return { collectionName, entry: savingEntry, changes, savingAssets, values };
};

/**
 * Get the pending entries to carry over to the draft being edited from the draft of an entry that
 * is being added to it: the entries created from the Relation fields of that entry with a nested
 * quick-add dialog, as long as the entry still refers to them. The ones the draft inherited from
 * the parent when it was started are already there.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry being added.
 * @param {EntryDraft} args.parentDraft Draft being edited.
 * @returns {PendingEntry[]} Pending entries.
 */
export const getNestedPendingEntries = ({ draft, parentDraft }) => {
  const parentIds = new Set(parentDraft.pendingEntries.map(({ entry }) => entry.id));

  return getReferencedPendingEntries(draft).filter(({ entry }) => !parentIds.has(entry.id));
};

/**
 * Select the given pending entry in the Relation field it was added from, so the user doesn’t have
 * to pick it from the options after creating it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft being edited.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {FieldKeyPath} args.keyPath Key path of the Relation field.
 * @param {DraftValueStoreKey} args.valueStoreKey Key to store the values in {@link EntryDraft}.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {PendingEntry} args.pendingEntry Pending entry to select.
 */
export const selectPendingEntry = ({
  draft,
  locale,
  keyPath,
  valueStoreKey,
  fieldConfig,
  pendingEntry,
}) => {
  const { i18n, multiple, max } = fieldConfig;

  // An entry with list fields in its templates can have more than one value; take the first
  const [value] = getEntryOptions({
    locale,
    fieldConfig,
    refEntry: pendingEntry.entry,
    pendingEntries: draft.pendingEntries,
  }).map((option) => option.value);

  if (value === undefined) {
    return;
  }

  if (!multiple) {
    // Writing the locale being edited is enough: the value store duplicates the value to the other
    // locales if the field is configured so
    draft[valueStoreKey][locale][keyPath] = value;

    return;
  }

  /**
   * Add the value to the list, unless it’s already there or the list is full.
   * @param {{ valueList: any[] }} args Arguments.
   */
  const manipulate = ({ valueList }) => {
    if (!valueList.includes(value) && (typeof max !== 'number' || valueList.length < max)) {
      valueList.push(value);
    }
  };

  forEachTargetLocale({ valueStore: draft[valueStoreKey], locale, i18n }, (_valueMap, _locale) => {
    updateListField({ draft, locale: _locale, valueStoreKey, keyPath, manipulate });
  });
};
