import {
  buildSingleFileContent,
  getFieldComments,
  getSingleFileComments,
} from '$lib/services/contents/draft/save/content';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * @import {
 * Entry,
 * FileConfig,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 */

/**
 * Serialize an entry’s content and format it as the data of one of the files the entry is stored
 * in, along with the `comment` field options to be written in a YAML file.
 * @param {object} args Arguments.
 * @param {any} args.draft Entry draft, or a synthetic draft holding the properties read by
 * {@link serializeContent}.
 * @param {InternalCollection | InternalCollectionFile} args.config Collection or collection file
 * holding the i18n configuration.
 * @param {FileConfig} args._file Entry file configuration.
 * @param {Entry} args.entry Entry to be saved.
 * @param {InternalLocaleCode} [args.locale] Locale of the file, when the collection uses a
 * file-per-locale i18n structure. Omit it for an entry stored in a single file, which then holds
 * every locale.
 * @returns {Promise<string>} Formatted file data.
 */
export const formatEntryData = ({ draft, config, _file, entry, locale }) =>
  formatEntryFile(
    locale === undefined
      ? {
          content: buildSingleFileContent({ config, entry, draft }),
          _file,
          comments: getSingleFileComments({ config, fields: draft.fields }),
        }
      : {
          content: serializeContent({ draft, locale, valueMap: entry.locales[locale].content }),
          _file,
          comments: getFieldComments(draft.fields),
        },
  );
