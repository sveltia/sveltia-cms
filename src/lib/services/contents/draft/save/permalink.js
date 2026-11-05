import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
import { fillPermalink, getPermalinkKey } from '$lib/services/contents/entry/permalink';

/**
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Store the path of the entry being saved in the property named with the `permalink_field` option.
 * The path can depend on the slug and on any field, so it’s worked out on every save, for a new
 * entry as well as an existing one. See {@link fillPermalink}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.content Flattened entry content to be modified in place.
 * @param {string} args.slug New entry slug for the locale.
 * @param {string} args.path New entry file path for the locale.
 */
export const setPermalink = ({ draft, locale, content, slug, path }) => {
  const { collection, fields, isIndexFile } = draft;

  // Don’t take a snapshot of the values for nothing
  if (!getPermalinkKey({ collection, fields })) {
    return;
  }

  fillPermalink({
    collection,
    fields,
    isIndexFile,
    locale,
    content,
    // A snapshot, which is replaced rather than changed as the draft is edited
    defaultContent: getValueMapSnapshot(draft, collection._i18n.defaultLocale),
    slug,
    path,
  });
};
