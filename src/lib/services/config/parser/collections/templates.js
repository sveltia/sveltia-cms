import { DATE_TIME_FIELDS, UUID_TYPES } from '$lib/services/common/template/constants';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { EntryCollection } from '$lib/types/public';
 */

/**
 * Template tags a slug or path template can use that don’t refer to a field: the date and time of
 * creation, a random ID, and the slug of the entry itself, which `{{slug}}` derives from the
 * identifier field and `{{fields._slug}}` reads from the slug editor.
 * @type {string[]}
 */
const SLUG_SPECIAL_TAGS = [
  ...DATE_TIME_FIELDS,
  ...Object.keys(UUID_TYPES),
  'slug',
  '_slug',
  'fields._slug',
];

/**
 * Template tags a summary template can use that don’t refer to a field: the entry’s slug, locales,
 * file path parts and commit information. The `title` tag is included because it falls back to the
 * entry’s summary whether or not a `title` field is defined.
 * @type {string[]}
 */
const SUMMARY_SPECIAL_TAGS = [
  'slug',
  'locales',
  'dirname',
  'filename',
  'extension',
  'commit_date',
  'commit_author',
  'title',
  'fields.title',
];

/**
 * Check the templates of an entry collection that refer to its fields: the `slug`, `path` and
 * `summary` options, along with the `thumbnail` option, which names fields directly. A tag that
 * names no field isn’t reported at runtime — a slug or path tag falls back to a random ID, and a
 * summary tag to nothing — so a typo only shows once entries have been saved under unexpected
 * names.
 *
 * Every tag is checked, not just the ones with the explicit `fields.` prefix, because the set of
 * special tags these templates support is known and small, unlike a `preview_path`.
 * @param {object} args Arguments.
 * @param {EntryCollection} args.collection Collection config to check.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkCollectionTemplates = ({ collection, context, collectors }) => {
  const { fields, slug, path, summary, thumbnail } = collection;

  // A collection without fields is reported separately
  if (!fields?.length) {
    return;
  }

  const args = { fields, context, collectors };

  checkFieldReferences({
    ...args,
    option: 'slug',
    template: slug,
    specialTags: SLUG_SPECIAL_TAGS,
  });

  checkFieldReferences({
    ...args,
    option: 'path',
    template: path,
    specialTags: SLUG_SPECIAL_TAGS,
  });

  checkFieldReferences({
    ...args,
    option: 'summary',
    template: summary,
    specialTags: SUMMARY_SPECIAL_TAGS,
  });

  // The `thumbnail` option lists key paths rather than a template; a boolean turns the thumbnails
  // on or off
  if (typeof thumbnail === 'string' || Array.isArray(thumbnail)) {
    checkFieldReferences({ ...args, option: 'thumbnail', keyPaths: thumbnail });
  }
};
