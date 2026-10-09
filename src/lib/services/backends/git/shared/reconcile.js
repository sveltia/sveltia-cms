/**
 * @import { Asset, Entry } from '$lib/types/private';
 */

/**
 * Get the key to match up an entry’s file with the same file of a previous entry. An entry
 * collection can store all the entries in one file, where an entry is told by its position.
 * @param {Entry} entry Entry.
 * @param {string} path Path of one of the entry’s files.
 * @returns {string} Key.
 */
const getFileKey = ({ arrayIndex }, path) =>
  arrayIndex === undefined ? path : `${path}#${arrayIndex}`;

/**
 * Carry the identity of the entries already in the store over to a freshly parsed list. An entry’s
 * `id` is made up when its files are parsed, so a second fetch would give every entry a new one,
 * and anything holding an ID — the editor’s draft, a selection in the list, a saved entry about to
 * replace its predecessor — would lose track of its entry. The ID is matched up through the file
 * paths instead. An entry none of whose files have changed is kept as the very same object, which
 * both spares the UI a re-render of everything and lets the caller tell what a fetch has changed by
 * comparing the objects.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries parsed from the latest fetch.
 * @param {Entry[]} args.previous Entries in the store at the moment.
 * @param {Set<string>} args.changedPaths Paths of the files whose content differs from what was
 * fetched last time.
 * @returns {Entry[]} The new list, with the previous IDs and objects wherever they apply.
 */
export const reconcileEntries = ({ entries, previous, changedPaths }) => {
  if (!previous.length) {
    return entries;
  }

  /** @type {Map<string, Entry>} */
  const previousByPath = new Map(
    previous.flatMap((entry) =>
      Object.values(entry.locales).map(({ path }) => [getFileKey(entry, path), entry]),
    ),
  );

  // A previous entry stands in for one new entry only. Its files can end up in two entries, e.g.
  // when a localized file has been given another canonical slug, and the second one is new
  const claimed = new Set();

  return entries.map((entry) => {
    const paths = Object.values(entry.locales).map(({ path }) => path);

    const match = paths
      .map((path) => previousByPath.get(getFileKey(entry, path)))
      .find((candidate) => !!candidate && !claimed.has(candidate));

    if (!match) {
      return entry;
    }

    claimed.add(match);

    const previousPaths = Object.values(match.locales).map(({ path }) => path);

    // A locale file added or removed makes it a different entry as far as the editor is concerned
    const unchanged =
      paths.length === previousPaths.length &&
      paths.every((path) => previousPaths.includes(path) && !changedPaths.has(path));

    return unchanged ? match : { ...entry, id: match.id };
  });
};

/**
 * Keep the asset objects already in the store wherever the file hasn’t changed, so that a blob URL
 * or thumbnail attached to one survives a fetch, and so that the caller can tell what has changed
 * by comparing the objects. An asset committed to an Editorial Workflow branch is not in the file
 * list of the configured branch, so it’s carried over the way `mergeWorkflowAssets` merged it: it
 * keeps shadowing the published file at the same path, which becomes its `replacedAsset`, and one
 * that only exists on the workflow branch stays at the end of the list.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets from the latest fetch.
 * @param {Asset[]} args.previous Assets in the store at the moment.
 * @param {Set<string>} args.changedPaths Paths of the files whose content differs from what was
 * fetched last time.
 * @returns {Asset[]} The new list, with the previous objects wherever they apply.
 */
export const reconcileAssets = ({ assets, previous, changedPaths }) => {
  if (!previous.length) {
    return assets;
  }

  const previousByPath = new Map(previous.map((asset) => [asset.path, asset]));
  const fetchedPaths = new Set(assets.map(({ path }) => path));

  /**
   * Put the given published asset under the workflow asset shadowing it.
   * @param {Asset} workflowAsset Workflow asset in the store.
   * @param {Asset | undefined} published Published asset at the same path, if any.
   * @returns {Asset} Workflow asset; the same object if its published version hasn’t changed.
   */
  const shadow = (workflowAsset, published) => {
    const { workflow } = /** @type {{ workflow: NonNullable<Asset['workflow']> }} */ (
      workflowAsset
    );

    return workflow.replacedAsset === published
      ? workflowAsset
      : { ...workflowAsset, workflow: { ...workflow, replacedAsset: published } };
  };

  return [
    ...assets.map((asset) => {
      const match = previousByPath.get(asset.path);
      const previousPublished = match?.workflow ? match.workflow.replacedAsset : match;

      const published =
        previousPublished && !changedPaths.has(asset.path) ? previousPublished : asset;

      return match?.workflow ? shadow(match, published) : published;
    }),
    // The published file a workflow asset was shadowing may have been deleted in the meantime
    ...previous
      .filter(({ path, workflow }) => !!workflow && !fetchedPaths.has(path))
      .map((asset) => shadow(asset, undefined)),
  ];
};
