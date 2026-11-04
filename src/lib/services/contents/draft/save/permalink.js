import { getCurrentSitePath } from '$lib/services/contents/draft/save/aliases';
import { getPermalinkKey } from '$lib/services/contents/entry/permalink';

/**
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Store the entry’s path on the live site, filled from the `preview_path` option, in the property
 * named with the `permalink_field` option, so the site is built with the path the CMS links to. The
 * path can depend on the slug and on any field, so it’s worked out on every save, for a new entry
 * as well as an existing one. If it can’t be, e.g. because the date it contains is empty, the
 * property is removed, as an outdated path could build the page over another one.
 *
 * Only a string is replaced: anything else in the property is the user’s, like Eleventy’s
 * `permalink: false`, which keeps a page from being built at all, or its object form.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.content Flattened entry content to be modified in place.
 * @param {string} args.slug Entry slug for the locale.
 * @param {string} args.path Entry file path for the locale.
 * @see https://github.com/sveltia/sveltia-cms/discussions/1133
 */
export const setPermalink = ({ draft, locale, content, slug, path }) => {
  const { isIndexFile, collection, fields } = draft;
  // This is `undefined` unless the option is enabled for an entry collection
  const permalinkKey = getPermalinkKey({ collection, fields });

  // The index file is Hugo’s, which doesn’t have a use for the property
  if (!permalinkKey || isIndexFile || !collection.preview_path) {
    return;
  }

  const isUserValue =
    typeof (content[permalinkKey] ?? '') !== 'string' ||
    Object.keys(content).some((keyPath) => keyPath.startsWith(`${permalinkKey}.`));

  if (isUserValue) {
    return;
  }

  const sitePath = getCurrentSitePath({ draft, locale, content, slug, path });

  if (sitePath === undefined) {
    delete content[permalinkKey];
  } else {
    content[permalinkKey] = sitePath;
  }
};
