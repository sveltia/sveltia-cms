/**
 * @import { Asset, Entry } from '$lib/types/private';
 */

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
    previous.flatMap((entry) => Object.values(entry.locales).map(({ path }) => [path, entry])),
  );

  // A previous entry stands in for one new entry only. Its files can end up in two entries, e.g.
  // when a localized file has been given another canonical slug, and the second one is new
  const claimed = new Set();

  return entries.map((entry) => {
    const paths = Object.values(entry.locales).map(({ path }) => path);

    const match = paths
      .map((path) => previousByPath.get(path))
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
 * by comparing the objects.
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

  return assets.map((asset) => {
    const match = previousByPath.get(asset.path);

    return match && !changedPaths.has(asset.path) ? match : asset;
  });
};
