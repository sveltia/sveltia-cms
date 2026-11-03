import { unique } from '@sveltia/utils/array';

import { isReadonly } from '$lib/services/config/readonly';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { countQuotaEntries } from '$lib/services/contents/collection/entries/count';
import { getDraftValues, isDraftModified } from '$lib/services/contents/draft';
import { restoreBackup } from '$lib/services/contents/draft/backup';
import { buildDraft } from '$lib/services/contents/draft/create';
import {
  getNewPendingEntriesByCollection,
  getPendingEntriesByCollection,
  getReferencedPendingEntrySet,
  isRelationFieldOf,
} from '$lib/services/contents/draft/pending-entries';
import {
  createSavingEntryData,
  removeDisabledLocales,
} from '$lib/services/contents/draft/save/changes';
import { compareWithStore } from '$lib/services/contents/draft/save/conflict';
import { assignSaveTimeValues } from '$lib/services/contents/draft/save/save-time';
import { getCanonicalSlug, getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';
import { isEntryEditableAlong } from '$lib/services/contents/entry/editable';
import { getField } from '$lib/services/contents/entry/fields';
import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getEntryOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import { renameIfNeeded } from '$lib/services/utils/file';
import { getSnapshot } from '$lib/services/utils/state.svelte';
import {
  findEditingUnpublishedEntry,
  getCompanionEntries,
  getEditedCompanionEntries,
  getUnpublishedEntry,
  getUnpublishedEntryByBranch,
  getUnpublishedEntryByDraft,
  isPendingDeletion,
  isWorkflowDraft,
  isWorkflowEnabled,
} from '$lib/services/workflow';
import { getUnpublishedEntryLabel } from '$lib/services/workflow/board';

/**
 * @import {
 * DraftValueStoreKey,
 * Entry,
 * EntryDraft,
 * EntrySlugVariants,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * PendingEntry,
 * QuickAddHost,
 * UnlistedEntry,
 * UnpublishedEntry,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
 */

/**
 * Get the entry the pending entries of the given draft are saved along with: the entry being
 * edited, or, in a quick-add dialog, the one the dialog was opened from, however deeply nested.
 * @param {EntryDraft} draft Draft.
 * @returns {QuickAddHost} Host entry.
 */
export const getQuickAddHost = (draft) =>
  draft.quickAddHost ?? {
    collectionName: draft.collectionName,
    workflow: isWorkflowDraft(draft),
    branch: getUnpublishedEntryByDraft(draft)?.workflow.pullRequest.branch,
    entryIds: [draft.id],
  };

/**
 * Get the host to give the draft of a quick-add dialog opened from the given draft: the same host,
 * along with the given draft’s own entry, so none of the entries being edited in the dialogs opened
 * so far can be edited again from a nested dialog, where its changes would be overwritten.
 * @param {EntryDraft} parentDraft Draft the dialog is opened from.
 * @returns {QuickAddHost} Host entry.
 */
export const getNestedQuickAddHost = (parentDraft) => {
  const host = getQuickAddHost(parentDraft);

  return { ...host, entryIds: unique([...host.entryIds, parentDraft.id]) };
};

/**
 * Get the unpublished entry the host entry of the given draft has been saved as, whose pull request
 * holds the entries created or edited from it earlier.
 * @param {EntryDraft} draft Draft.
 * @returns {UnpublishedEntry | undefined} Unpublished entry, or `undefined` if the host entry has
 * no pull request.
 */
const getHostUnpublishedEntry = (draft) => {
  const { branch } = getQuickAddHost(draft);

  return branch ? getUnpublishedEntryByBranch(branch) : undefined;
};

/**
 * Get the new entries in the given collection that an earlier save of the host entry has committed
 * to its pull request, along with it. They aren’t in the collection until the pull request is
 * published.
 * @param {EntryDraft} draft Draft.
 * @param {string} collectionName Collection name.
 * @returns {Entry[]} Entries.
 */
const getHostCompanionEntries = (draft, collectionName) => {
  const hostEntry = getHostUnpublishedEntry(draft);

  return hostEntry ? getCompanionEntries(collectionName, [hostEntry]) : [];
};

/**
 * Get the entries a Relation field value of the given draft can refer to before they’re among the
 * entries of their collection: those an earlier save of the host entry has created or changed in
 * its pull request, and the entries pending on the draft, which come last, so they take the place
 * of an earlier version. A label resolved through a Relation field of a referenced entry finds them
 * there, as they aren’t in the collection until they’re saved, or the pull request is published.
 * @param {EntryDraft | null | undefined} draft Draft being edited.
 * @param {PendingEntry[]} [pendingEntries] Pending entries to include. Default: those of the draft.
 * @returns {UnlistedEntry[] | undefined} Entries, or `undefined` without a draft.
 */
export const getUnlistedEntries = (draft, pendingEntries = undefined) => {
  if (!draft) {
    return undefined;
  }

  const entries = pendingEntries ?? draft.pendingEntries;
  const companions = getHostUnpublishedEntry(draft)?.workflow.companions ?? [];

  return companions.length ? [...companions, ...entries] : entries;
};

/**
 * Get the given existing entry as it is now for the host entry of the given draft: as an earlier
 * save of the host entry has created or changed it in its pull request, or as it is on the
 * configured branch.
 * @param {EntryDraft} draft Draft.
 * @param {string} id Entry ID.
 * @returns {Entry | undefined} Entry, or `undefined` if it has been deleted.
 */
export const getLatestEntry = (draft, id) => {
  const hostEntry = getHostUnpublishedEntry(draft);

  return (
    (hostEntry?.workflow.companions ?? []).find(({ entry }) => entry.id === id)?.entry ??
    allEntries.current.find((entry) => entry.id === id)
  );
};

/**
 * Compare the given version of an existing entry edited from a Relation field with the entry as it
 * is now for the host entry of the given draft, to tell whether someone else has changed it since.
 * See {@link getLatestEntry}.
 * @param {EntryDraft} draft Draft.
 * @param {Entry} baseEntry Version of the entry the edits were made to.
 * @returns {EntryConflict | undefined} The conflict, if any.
 */
export const compareWithLatest = (draft, baseEntry) => {
  const latestEntry = getLatestEntry(draft, baseEntry.id);

  return compareWithStore(baseEntry, { entries: latestEntry ? [latestEntry] : [] });
};

/**
 * Check whether an entry of the given collection can be saved along with the host entry. While the
 * host entry is saved through Editorial Workflow, the entry goes into its pull request, where it’s
 * reviewed and published along with it, unless it’s in the same collection: the pull request
 * stands for the host entry, whose card lists the other entries, so one of the same collection
 * couldn’t be told apart from it. Otherwise, the entry is committed along with the host entry, so
 * it can’t be in a collection under the workflow, which would skip the review the collection asks
 * for. The same goes for publishing the host entry without its review: see `canSkipReviewAlong()`
 * in the workflow service.
 * @param {QuickAddHost} host Host entry.
 * @param {InternalEntryCollection} collection Collection of the entry.
 * @returns {boolean} Result.
 */
const canSaveAlongHost = (host, collection) =>
  host.workflow ? collection.name !== host.collectionName : !isWorkflowEnabled(collection);

/**
 * Get the collection a Relation field can have a new entry created in, so the entry can be
 * referenced right away. That’s the referenced collection, provided it holds entries that can be
 * created: a file/singleton collection has a fixed set of files, and a reference to one of them
 * points at a list item within the file, so there is nothing to create there. Nor can anything be
 * created in a read-only collection, or in one whose entries can’t be saved along with the host
 * entry: see {@link canSaveAlongHost}.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {EntryDraft} args.draft Draft being edited.
 * @returns {InternalEntryCollection | undefined} Collection, or `undefined` if entries can’t be
 * created for the field.
 * @see https://github.com/sveltia/sveltia-cms/issues/1112
 */
export const getCreatableCollection = ({
  fieldConfig: { collection: collectionName, file: fileName },
  draft,
}) => {
  if (fileName) {
    return undefined;
  }

  const collection = getCollection(collectionName);

  if (collection?._type !== 'entry' || collection.create === false || isReadonly({ collection })) {
    return undefined;
  }

  return canSaveAlongHost(getQuickAddHost(draft), collection) ? collection : undefined;
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
  // The entries only existing in a pull request take up a slot as well, while the collection’s
  // index file, its own page rather than one of the entries in it, doesn’t — see
  // `countQuotaEntries()`. That includes the new entries riding along in one, which a pending entry
  // becomes once the draft is saved, while the editor may stay open on the draft
  const companionIds = new Set(getCompanionEntries(name).map(({ id }) => id));

  const pendingCount = getNewPendingEntriesByCollection(draft, name).filter(
    ({ entry }) => !companionIds.has(entry.id),
  ).length;

  return countQuotaEntries(name) + pendingCount < limit;
};

/**
 * Get the pending entries of the draft that the given Relation field can refer to, in the shape of
 * the entries the field is offered otherwise, followed by the entries an earlier save of the host
 * entry has committed to its pull request.
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

  // A pending entry becomes one riding along in the pull request once the draft is saved, while the
  // editor may stay open on the draft, so each entry is only offered once
  const seenIds = new Set(refEntries.map(({ id }) => id));

  return [
    ...getPendingEntriesByCollection(draft, collectionName).map(({ entry }) => entry),
    ...getHostCompanionEntries(draft, collectionName),
  ].filter(({ id }) => {
    if (seenIds.has(id)) {
      return false;
    }

    seenIds.add(id);

    return true;
  });
};

/**
 * Get the entries the given Relation field refers to, followed by the pending entries of the draft
 * it can refer to: the entries created from the field, or another one referring to the same
 * collection, are offered and shown along with the saved ones until they’re saved too. An entry
 * edited from such a field is offered as edited, in its own place, including one an earlier save
 * of the host entry has changed in its pull request.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Draft being edited.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @returns {Entry[]} Entries.
 */
export const getRefEntriesWithPending = ({ draft, fieldConfig }) => {
  const savedEntries = getRefEntries(fieldConfig);
  const hostEntry = draft ? getHostUnpublishedEntry(draft) : undefined;

  // An entry edited from the field since is offered as edited, and one changed in the pull request
  // of the host entry by an earlier save as it stands there
  const editedEntries = new Map([
    ...(hostEntry ? getEditedCompanionEntries(fieldConfig.collection, [hostEntry]) : []).map(
      (entry) => /** @type {[string, Entry]} */ ([entry.id, entry]),
    ),
    ...(draft ? getPendingEntriesByCollection(draft, fieldConfig.collection) : [])
      .filter(({ baseEntry }) => !!baseEntry)
      .map(({ entry }) => /** @type {[string, Entry]} */ ([entry.id, entry])),
  ]);

  const refEntries = editedEntries.size
    ? savedEntries.map((entry) => editedEntries.get(entry.id) ?? entry)
    : savedEntries;

  const pendingEntries = getPendingRefEntries({ draft, fieldConfig, refEntries });

  return pendingEntries.length ? [...refEntries, ...pendingEntries] : refEntries;
};

/**
 * Determine the slugs of an entry to be added to the draft. The slug is made unique among the
 * entries in the collection, but the entries pending on the draft aren’t there yet, so a second
 * entry added with the same title would get the same slug — and overwrite the first one on save.
 * The default locale’s slug is renamed if it’s taken by a pending entry, along with the slugs that
 * derive from it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry to be added.
 * @param {PendingEntry[]} args.pendingEntries Entries pending on the draft being edited, apart
 * from an earlier version of the entry to be added, if it’s added again after a change.
 * @returns {EntrySlugVariants} Slugs.
 */
export const getPendingEntrySlugs = ({ draft, pendingEntries }) => {
  // A numbered slug comes after the ones the entries pending on the parent draft have taken
  const slugs = getSlugs({ draft, pendingEntries });
  const { defaultLocaleSlug, localizedSlugs } = slugs;

  // The entries riding along in a pull request, this one’s or another’s, aren’t there either
  const pendingSlugs = [
    ...pendingEntries
      .filter((pendingEntry) => pendingEntry.collectionName === draft.collectionName)
      .map(({ entry }) => entry),
    ...getCompanionEntries(draft.collectionName),
  ].map(({ slug }) => slug);

  if (renameIfNeeded(defaultLocaleSlug, pendingSlugs) === defaultLocaleSlug) {
    return slugs;
  }

  // The new slug has to be free among the saved entries as well, which the slug above was made
  // unique against, but a renamed one wasn’t. A dot in a slug is part of the name rather than a
  // file extension, so the number goes at the end
  const renamedSlug = renameIfNeeded(
    defaultLocaleSlug,
    [...pendingSlugs, ...getEntriesByCollection(draft.collectionName).map(({ slug }) => slug)],
    { hasExtension: false },
  );

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
 * Turn the draft of an entry into a pending entry of the draft being edited: the entry is prepared
 * for saving the same way any entry is, and the file changes are held on the parent draft until
 * that one is saved. The draft can be a new entry, an entry already pending on the parent draft
 * that is opened again, or an existing entry being edited. The draft has to be valid; the caller
 * checks that, as it also reports the errors.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry to be added.
 * @param {EntryDraft} args.parentDraft Draft being edited.
 * @param {RelationField} args.fieldConfig Configuration of the Relation field the entry is added
 * from, which decides the values the entry goes by.
 * @returns {Promise<PendingEntry>} Pending entry.
 */
export const createPendingEntry = async ({ draft, parentDraft, fieldConfig }) => {
  const { id, isNew, collectionName, originalEntry } = draft;
  // The values the draft holds before they’re prepared for saving, blob URLs included, so the entry
  // can be opened again. Taken before the save-time values below are assigned, which the entry
  // gets anew when it’s added again
  const source = getDraftValues(draft);
  // An entry added again after a change takes the place of its earlier version
  const otherPendingEntries = parentDraft.pendingEntries.filter(({ entry }) => entry.id !== id);
  const newPendingEntries = getNewPendingEntriesByCollection(parentDraft, collectionName);
  const index = newPendingEntries.findIndex(({ entry }) => entry.id === id);
  // Each new entry takes the next order and number, the same way an entry saved on its own would.
  // One added again keeps its place among the others
  const offset = index > -1 ? index : newPendingEntries.length;

  // The dates are set when the entry is added rather than when it’s saved along with the parent,
  // which is when the changes were made
  assignSaveTimeValues(draft, offset);

  // An existing entry keeps its slug; the slug editor isn’t offered for it in the dialog
  const slugs = isNew
    ? getPendingEntrySlugs({ draft, pendingEntries: otherPendingEntries })
    : getSlugs({ draft });

  // The `preSave` event hooks are called when the entry is actually saved, along with the parent
  const prepared = await createSavingEntryData({ draft, slugs, runPreSave: false });
  const { changes, savingAssets } = prepared;
  // The locales turned off have no file to save, so they’re left out of the entry the stores get
  const savingEntry = removeDisabledLocales(prepared.savingEntry);

  // The value can be localized, e.g. `{{locale}}/{{slug}}`, so collect it for every locale the
  // parent entry has
  const values = unique(
    Object.keys(parentDraft.currentValues).flatMap((locale) =>
      getEntryOptions({
        locale,
        fieldConfig,
        refEntry: savingEntry,
        pendingEntries: getUnlistedEntries(parentDraft, otherPendingEntries),
      }).map(({ value }) => value),
    ),
  );

  return {
    collectionName,
    entry: savingEntry,
    changes,
    savingAssets,
    values,
    ...(isNew || !originalEntry ? {} : { baseEntry: getSnapshot(originalEntry) }),
    source,
  };
};

/**
 * Work out what the quick-add dialog opens to edit the given entry: the pending entry it stands
 * for, if it has been added or edited from the parent draft already, and the version of an existing
 * entry the dialog’s draft is built from. That’s the latest version of the entry, so a change made
 * by someone else since the entry was edited is picked up, and reported, rather than undone without
 * notice. An entry deleted since is edited from the version it was edited from. See
 * {@link getLatestEntry}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.parentDraft Draft being edited, holding the pending entries.
 * @param {Entry} [args.entry] Entry to edit, as the field offers it. `undefined` for a new entry.
 * @returns {{ pendingEntry?: PendingEntry, baseEntry?: Entry, changedSince: boolean }} Pending
 * entry, base entry, and whether the entry has been changed by someone else since it was edited.
 */
export const getEditTarget = ({ parentDraft, entry }) => {
  if (!entry) {
    return { changedSince: false };
  }

  const pendingEntry = parentDraft.pendingEntries.find(({ entry: { id } }) => id === entry.id);

  if (!pendingEntry) {
    return { baseEntry: entry, changedSince: false };
  }

  const { baseEntry } = pendingEntry;

  if (!baseEntry) {
    return { pendingEntry, changedSince: false };
  }

  const latestEntry = getLatestEntry(parentDraft, baseEntry.id);

  return {
    pendingEntry,
    baseEntry: latestEntry ?? baseEntry,
    changedSince: !!latestEntry && !!compareWithLatest(parentDraft, baseEntry),
  };
};

/**
 * Build the draft the quick-add dialog edits: a new entry, or the given entry. An entry pending on
 * the parent draft is opened with the values it was added with, on top of the latest version of the
 * entry if it’s an existing one, so the changes made by someone else since can be reviewed. See
 * {@link getEditTarget}.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection of the entry.
 * @param {EntryDraft} args.parentDraft Draft the dialog is opened from.
 * @param {Entry} [args.entry] Entry to edit. `undefined` for a new entry.
 * @returns {Promise<{ draft: EntryDraft, changedSince: boolean }>} Draft, and whether the entry has
 * been changed by someone else since it was edited.
 */
export const buildQuickAddDraft = async ({ collection, parentDraft, entry }) => {
  const parentPendingEntries = parentDraft.pendingEntries;
  const { pendingEntry, baseEntry, changedSince } = getEditTarget({ parentDraft, entry });

  // A new entry starts at the root of the collection folder. The default is the folder being
  // browsed, which belongs to the parent entry’s collection. The entry kept on the parent draft is
  // a `$state` proxy, which the draft can’t clone
  const draft = baseEntry
    ? buildDraft({ collection, originalEntry: getSnapshot(baseEntry) })
    : buildDraft({ collection, initialPath: '' });

  if (pendingEntry?.source) {
    // A new entry keeps its ID, so it takes the place of its earlier version when added again
    draft.id = pendingEntry.entry.id;
    // The values are copied, as the restore updates them in place
    await restoreBackup({ backup: getSnapshot(pendingEntry.source), draft });
  }

  // The entries pending on the parent draft are offered to the Relation fields of the entry as
  // well, and a nested quick-add takes them into account when it names and counts entries
  draft.pendingEntries = [...parentPendingEntries];
  // The entry is saved along with the entry being edited, which decides what can be added from the
  // Relation fields of the entry in turn
  draft.quickAddHost = getNestedQuickAddHost(parentDraft);

  return { draft, changedSince };
};

/**
 * Check whether saving the given pending entry would move one of its files, e.g. when the path
 * template of the collection uses a field that has been changed. Moving an entry takes the entries
 * nested under it and the assets stored next to it along, and rewrites the entries referencing it,
 * which a save of the entry on its own does, but not one along with another entry.
 * @param {PendingEntry} pendingEntry Pending entry.
 * @returns {boolean} Result.
 */
export const isPendingEntryMoved = ({ baseEntry, changes }) =>
  !!baseEntry && changes.some(({ action }) => action === 'move');

/**
 * Take back the values assigned to the given draft when it was turned into the given pending entry,
 * e.g. the `auto_now` dates, if the entry isn’t added after all. They would otherwise count as a
 * change to the draft, so an entry put back as it was would be saved for nothing. A value is only
 * taken back while it’s still the one the entry was prepared with, so anything typed in the
 * meantime is kept.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry that wasn’t added.
 * @param {PendingEntry} args.pendingEntry Pending entry made from the draft.
 */
export const revertSaveTimeValues = ({ draft, pendingEntry: { entry, source } }) => {
  Object.entries(source?.currentValues ?? {}).forEach(([locale, valueMap]) => {
    const preparedValues = entry.locales[locale]?.content ?? {};
    const currentValueMap = draft.currentValues[locale];

    // The values are only ever assigned to the fields the draft already has
    Object.entries(valueMap).forEach(([keyPath, value]) => {
      if (
        currentValueMap[keyPath] !== value &&
        currentValueMap[keyPath] === preparedValues[keyPath]
      ) {
        currentValueMap[keyPath] = value;
      }
    });
  });
};

/**
 * Add the given pending entries to the draft being edited. An entry already pending there, which
 * has been opened again and changed, takes the place of its earlier version.
 * @param {EntryDraft} draft Draft being edited.
 * @param {PendingEntry[]} pendingEntries Pending entries to add.
 */
export const addPendingEntries = (draft, pendingEntries) => {
  pendingEntries.forEach((pendingEntry) => {
    const index = draft.pendingEntries.findIndex(({ entry }) => entry.id === pendingEntry.entry.id);

    if (index > -1) {
      draft.pendingEntries[index] = pendingEntry;
    } else {
      draft.pendingEntries.push(pendingEntry);
    }
  });
};

/**
 * Get the pending entries to carry over to the draft being edited from the draft of an entry that
 * is being added to it: the entries created or edited from the Relation fields of that entry with a
 * nested quick-add dialog, as long as the entry still refers to them. The ones the draft inherited
 * from the parent when it was started are already there, unless they’ve been changed since.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry being added.
 * @param {EntryDraft} args.parentDraft Draft being edited.
 * @returns {PendingEntry[]} Pending entries.
 */
export const getNestedPendingEntries = ({ draft, parentDraft }) => {
  const referenced = getReferencedPendingEntrySet(draft);

  return draft.pendingEntries
    .filter(
      (pendingEntry) =>
        referenced.has(pendingEntry) && !parentDraft.pendingEntries.includes(pendingEntry),
    )
    .map((pendingEntry) => getSnapshot(pendingEntry));
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
    // The same entries as the value the pending entry is saved for is worked out with
    pendingEntries: getUnlistedEntries(draft),
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

  updateListFieldForLocales({
    draft,
    locale,
    i18n,
    fieldConfig,
    valueStoreKey,
    keyPath,
    manipulate,
  });
};

/**
 * Check whether the given draft of an existing entry, opened in the quick-add dialog, has been left
 * as it was, in which case there’s nothing to save along with the parent: adding it anyway would
 * rewrite the entry’s files for nothing. An entry edited before is still added again, as the user
 * may have undone the earlier changes, which then have to replace them. The entries the draft
 * inherited from the parent don’t count as a change, while those added from its own Relation
 * fields do.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the entry opened in the dialog.
 * @param {EntryDraft} args.parentDraft Draft being edited.
 * @returns {boolean} Result.
 */
export const isEditUnchanged = ({ draft, parentDraft }) =>
  !draft.isNew &&
  !parentDraft.pendingEntries.some(({ entry }) => entry.id === draft.id) &&
  !isDraftModified({ ...draft, pendingEntries: [] }) &&
  !getNestedPendingEntries({ draft, parentDraft }).length;

/**
 * Replace the values the entry being edited holds for an entry that has been changed with the
 * quick-add dialog, in every locale, if the change has changed the values the entry goes by, e.g.
 * the title of an entry referenced by its title, or the slug of a new entry that follows its title.
 * A field would otherwise be left pointing at an entry that no longer goes by the value. Not only
 * the Relation field the dialog was opened from is updated, but every Relation field of the entry
 * pointing at the same collection, e.g. `author` and `reviewers` both pointing at `authors`, each
 * with the values its own `value_field` gives. The values of a rich text editor component, whose
 * fields can’t be looked up, are only updated in the Relation field the dialog was opened from.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft being edited.
 * @param {FieldKeyPath} args.keyPath Key path of the Relation field.
 * @param {DraftValueStoreKey} args.valueStoreKey Key to store the values in {@link EntryDraft}.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry} args.previousEntry Entry as it was before the change.
 * @param {Entry} args.entry Entry as it is now.
 */
export const replaceEntryValues = ({
  draft,
  keyPath,
  valueStoreKey,
  fieldConfig,
  previousEntry,
  entry,
}) => {
  const pendingEntries = getUnlistedEntries(draft);
  const { collectionName, fileName, isIndexFile } = draft;
  const refCollectionName = fieldConfig.collection;

  /**
   * Get the values to replace in the given locale for the given Relation field, keyed by the values
   * the entry went by.
   * @param {InternalLocaleCode} locale Locale.
   * @param {RelationField} config Field configuration.
   * @returns {Map<any, any>} Replacements, which are empty if the values haven’t changed, or can’t
   * be paired, as a list field used in the templates has gained or lost an item.
   */
  const getReplacements = (locale, config) => {
    /**
     * Get the values the given entry goes by in the locale.
     * @param {Entry} refEntry Entry.
     * @returns {any[]} Values.
     */
    const getValues = (refEntry) =>
      getEntryOptions({ locale, fieldConfig: config, refEntry, pendingEntries }).map(
        ({ value }) => value,
      );

    const oldValues = getValues(previousEntry);
    const newValues = getValues(entry);

    if (oldValues.length !== newValues.length) {
      return new Map();
    }

    return new Map(
      oldValues
        .map((value, index) => /** @type {[any, any]} */ ([value, newValues[index]]))
        .filter(([oldValue, newValue]) => oldValue !== newValue),
    );
  };

  /**
   * Replace the values held at the given key paths.
   * @param {FlattenedEntryContent} valueMap Values of a locale.
   * @param {FieldKeyPath[]} keyPaths Key paths.
   * @param {Map<any, any>} replacements Replacements.
   */
  const replaceValues = (valueMap, keyPaths, replacements) => {
    keyPaths.forEach((key) => {
      if (replacements.has(valueMap[key])) {
        valueMap[key] = replacements.get(valueMap[key]);
      }
    });
  };

  Object.entries(draft.currentValues).forEach(([locale, valueMap]) => {
    /**
     * Replacements for each Relation field found, as the fields of a list share the configuration.
     * @type {Map<RelationField, Map<any, any>>}
     */
    const replacementsByField = new Map();

    Object.keys(valueMap).forEach((key) => {
      const relationField = getField({
        collectionName,
        fileName,
        isIndexFile,
        valueMap,
        keyPath: key,
      });

      if (!isRelationFieldOf(relationField, refCollectionName)) {
        return;
      }

      if (!replacementsByField.has(relationField)) {
        replacementsByField.set(relationField, getReplacements(locale, relationField));
      }

      replaceValues(
        valueMap,
        [key],
        /** @type {Map<any, any>} */ (replacementsByField.get(relationField)),
      );
    });
  });

  if (valueStoreKey === 'extraValues') {
    Object.entries(draft.extraValues).forEach(([locale, valueMap]) => {
      const keyPaths = fieldConfig.multiple
        ? getListItemKeys(valueMap, keyPath, { live: true })
        : [keyPath];

      replaceValues(valueMap, keyPaths, getReplacements(locale, fieldConfig));
    });
  }
};

/**
 * Check whether the given entry, referenced by a Relation field, can be edited with the quick-add
 * dialog, and saved along with the entry being edited. An entry created from a Relation field can
 * be changed until it’s saved. An existing entry can be edited if it’s in an entry collection where
 * it can be saved on its own, provided it’s not the entry being edited itself, and can be saved
 * along with the entry being edited: see {@link canSaveAlongHost} and {@link isEntryEditableAlong}.
 * Nor is an entry offered that another pull request changes already: its own, or that of another
 * entry it has been edited along with. Nor one that has been changed on the configured branch since
 * the pull request of the entry being edited was opened, as its branch, which is never rebased,
 * still has the entry as it was then, or not at all: the edit would then be refused as an
 * unexpected change on publishing, or conflict with the newer version when merged.
 * @param {object} args Arguments.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {EntryDraft} args.draft Draft being edited.
 * @param {Entry} args.entry Referenced entry.
 * @returns {boolean} Result.
 */
export const canEditEntry = ({
  fieldConfig: { collection: collectionName, file },
  draft,
  entry,
}) => {
  const pendingEntry = getPendingEntriesByCollection(draft, collectionName).find(
    (_pendingEntry) => _pendingEntry.entry.id === entry.id,
  );

  // The dialog can only be opened again with the values of the draft, which an entry added before
  // they were kept doesn’t have
  if (pendingEntry && !pendingEntry.source) {
    return false;
  }

  if (pendingEntry && !pendingEntry.baseEntry) {
    return true;
  }

  const collection = getCollection(collectionName);

  if (
    file ||
    collection?._type !== 'entry' ||
    isReadonly({ collection }) ||
    !isEntryEditableAlong(collection, entry) ||
    isPendingDeletion(entry)
  ) {
    return false;
  }

  const host = getQuickAddHost(draft);

  if (!canSaveAlongHost(host, collection)) {
    return false;
  }

  // Another pull request changes the entry already: its own, or that of another entry it has been
  // edited along with
  const editingEntry = findEditingUnpublishedEntry(entry);

  if (
    !!getUnpublishedEntry({ collectionName, subPath: entry.subPath }) ||
    (!!editingEntry && editingEntry.workflow.pullRequest.branch !== host.branch)
  ) {
    return false;
  }

  // An entry the pull request already changes, or holds as a new entry, is on its branch as it is
  if (!editingEntry && host.branch && entry.commitDate) {
    const { pullRequest, companions = [] } =
      getUnpublishedEntryByBranch(host.branch)?.workflow ?? {};

    if (
      pullRequest &&
      entry.commitDate > pullRequest.createdDate &&
      !companions.some((companion) => companion.entry.id === entry.id)
    ) {
      return false;
    }
  }

  return entry.id !== draft.id && !host.entryIds.includes(entry.id);
};

/**
 * Get the entries selected in the given Relation field that can be edited with the quick-add
 * dialog. A value matching more than one entry, e.g. a title two entries share, can’t tell which
 * entry it refers to, so it’s left out.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft being edited.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {RelationField} args.fieldConfig Field configuration.
 * @param {Entry[]} args.refEntries Entries the field can refer to, pending ones included. See
 * {@link getRefEntriesWithPending}.
 * @param {any} args.currentValue Field value: a single value, or a list of values if the field
 * allows multiple values.
 * @returns {{ value: any, label: string, entry: Entry }[]} Selected entries with the value and the
 * label they’re selected by.
 */
export const getEditableEntries = ({ draft, locale, fieldConfig, refEntries, currentValue }) => {
  const values = (Array.isArray(currentValue) ? currentValue : [currentValue]).filter(
    (value) => value !== undefined && value !== null && value !== '',
  );

  if (!values.length) {
    return [];
  }

  const pendingEntries = getUnlistedEntries(draft);
  const valueSet = new Set(values);

  // Only the options going by a selected value are kept, grouped by the value
  const optionsByValue = Map.groupBy(
    refEntries.flatMap((entry) =>
      getEntryOptions({ locale, fieldConfig, refEntry: entry, pendingEntries })
        .filter(({ value }) => valueSet.has(value))
        .map(({ label, value }) => ({ value, label, entry })),
    ),
    ({ value }) => value,
  );

  // Two values can go by the same entry, e.g. two items of a list field used as the value, which is
  // then offered once
  const seenIds = new Set();

  return values.flatMap((value) => {
    const [match, ...others] = optionsByValue.get(value) ?? [];

    if (
      !match ||
      others.some(({ entry }) => entry.id !== match.entry.id) ||
      seenIds.has(match.entry.id) ||
      !canEditEntry({ fieldConfig, draft, entry: match.entry })
    ) {
      return [];
    }

    seenIds.add(match.entry.id);

    return [match];
  });
};

/**
 * Get the name of the entry whose pull request changes the entry of the given draft along with it,
 * the entry having been edited from a Relation field of that entry. Saving the draft on its own
 * then changes the entry in two places, which Git combines or refuses to combine when the pull
 * request is published.
 * @param {EntryDraft | null | undefined} draft Draft being edited.
 * @returns {string | undefined} Name of the entry, e.g. its title, or `undefined` if no other pull
 * request changes the entry.
 */
export const getEditingHostName = (draft) => {
  if (!draft || draft.isNew || !draft.originalEntry) {
    return undefined;
  }

  const hostEntry = findEditingUnpublishedEntry(draft.originalEntry);

  return hostEntry ? getUnpublishedEntryLabel(hostEntry) : undefined;
};
