import { backend } from '$lib/services/backends';
import { formatEntryData } from '$lib/services/contents/draft/save/entry-file';
import { getSavedFileConfig } from '$lib/services/contents/file/detected-formats';
import { getRepositoryDatabase } from '$lib/services/utils/database';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Entry,
 * FileChange,
 * FileConfig,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalI18nOptions,
 * InternalLocaleCode,
 * RepositoryFileInfo,
 * } from '$lib/types/private';
 */

/**
 * A change to one of the files an entry occupies, as planned by the caller of
 * {@link buildEntryFileChanges}, which then fills in the previous SHA and the file data.
 * @typedef {Omit<FileChange, 'previousSha' | 'data'> & { currentPath?: string }} EntryFilePlan
 * The `currentPath` is the path the file is stored at now, to look up its SHA with. It’s
 * `undefined` for a new file.
 */

/**
 * Resolve a usable file-cache `IndexedDB` handle: prefer the caller-provided one (so the same
 * handle is shared across composite operations like delete + renumber), otherwise open one.
 * @param {IndexedDB} [provided] Caller-provided handle.
 * @returns {IndexedDB | undefined} Cache handle, or `undefined` if no backend is configured.
 */
export const resolveCacheDB = (provided) => {
  if (provided) {
    return provided;
  }

  return getRepositoryDatabase(backend.current?.repository, 'file-cache');
};

/**
 * Get the previous SHA of the file from the cache database.
 * @param {object} args Arguments.
 * @param {string | undefined} args.previousPath Previous file path.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @returns {Promise<string | undefined>} Previous SHA or `undefined` if not found.
 */
export const getPreviousSha = async ({ previousPath, cacheDB }) => {
  if (!previousPath) {
    return undefined;
  }

  const cache = /** @type {RepositoryFileInfo | undefined} */ (await cacheDB?.get(previousPath));

  return cache?.sha;
};

/**
 * Check if the entries of a collection are stored in a single file each, rather than in a file per
 * locale.
 * @param {InternalI18nOptions} i18n Normalized i18n configuration of the collection or collection
 * file.
 * @returns {boolean} Result.
 */
export const isSingleFileEntry = ({
  i18nEnabled,
  structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot } = /** @type {any} */ ({}),
}) => !i18nEnabled || !!i18nSingleFile || !!i18nSingleFileDefaultRoot;

/**
 * Build the file changes for an entry, one for each file it occupies: a single one, or one per
 * locale if the collection uses a file-per-locale i18n structure. The caller plans each change,
 * and the previous SHA and the data of the file are filled in. A deleted file has no data.
 * @param {object} args Arguments.
 * @param {any} args.draft Entry draft, or a synthetic draft holding the properties read by
 * {@link formatEntryData}.
 * @param {InternalCollection | InternalCollectionFile} args.config Collection or collection file
 * the entry belongs to.
 * @param {FileConfig} args._file Entry file configuration.
 * @param {Entry} args.entry Entry to be saved.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @param {(locale?: InternalLocaleCode) => EntryFilePlan | undefined} args.planChange Function
 * planning the change to the file of the given locale, or to the single file if no locale is
 * given. It returns `undefined` if the file doesn’t change.
 * @returns {Promise<FileChange[]>} File changes.
 */
export const buildEntryFileChanges = async ({
  draft,
  config,
  _file,
  entry,
  cacheDB,
  planChange,
}) => {
  const locales = isSingleFileEntry(config._i18n) ? [undefined] : config._i18n.allLocales;

  const changes = await Promise.all(
    locales.map(async (locale) => {
      const plan = planChange(locale);

      if (!plan) {
        return undefined;
      }

      const { currentPath, ...change } = plan;

      if (change.action === 'delete') {
        return {
          ...change,
          previousSha: await getPreviousSha({ cacheDB, previousPath: currentPath }),
        };
      }

      const [previousSha, data] = await Promise.all([
        getPreviousSha({ cacheDB, previousPath: currentPath }),
        formatEntryData({
          draft,
          config,
          _file: getSavedFileConfig({ _file, previousPath: currentPath, path: change.path }),
          entry,
          locale,
        }),
      ]);

      return { ...change, previousSha, data };
    }),
  );

  return /** @type {FileChange[]} */ (changes.filter(Boolean));
};
