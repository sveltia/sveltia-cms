import { getPreviewPath } from '$lib/services/contents/entry';
import {
  getAliasesKey,
  getAliasKeyPaths,
  removeAliases,
} from '$lib/services/contents/entry/aliases';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 */

/**
 * Normalize the given path so it can be used as an alias. Both Hugo and Zola resolve an alias
 * relative to the current page unless it starts with a slash, so make it site-relative.
 * @param {string | undefined} path Path generated from the `preview_path` template.
 * @returns {string | undefined} Normalized path, or `undefined` if the path is not available.
 */
const normalizePath = (path) => (path === undefined ? undefined : `/${path.replace(/^\//, '')}`);

/**
 * Add the entry’s previous path to the `aliases` list so links to the old path keep working after
 * the slug has been edited. This only applies when the `preview_path` option is defined on the
 * collection, because that option is what allows the CMS to know the entry’s path on the live site.
 * If the property doesn’t exist yet, it’s created as a list with a single item; if it already
 * exists as a list, the previous path is appended to it. A property with any other shape, such as a
 * plain string, is left untouched so a user-defined value is never lost. The property name can be
 * customized with the `aliases_field` option, which can also be set to `false` to skip the
 * processing entirely.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.content Flattened entry content to be modified in place.
 * @param {string} args.slug New entry slug for the locale.
 * @param {string} args.path New entry file path for the locale.
 * @see https://github.com/sveltia/sveltia-cms/discussions/731
 */
export const addAlias = ({ draft, locale, content, slug, path }) => {
  const { isNew, isIndexFile, collection, fields, originalEntry } = draft;

  // The index file’s slug is fixed, so it can never be renamed
  if (isNew || isIndexFile || !originalEntry) {
    return;
  }

  const { preview_path: pathTemplate } = /** @type {InternalEntryCollection} */ (collection);
  // This is `undefined` for anything but an entry collection, whose slugs are the only editable
  // ones, so no further collection type check is needed below
  const aliasesKey = getAliasesKey({ collection, fields });

  if (!pathTemplate || !aliasesKey) {
    return;
  }

  const {
    slug: originalSlug,
    path: originalPath,
    content: originalContent,
  } = originalEntry.locales[locale] ?? {};

  // Nothing to do if the locale has just been enabled or the slug is unchanged
  if (originalSlug === undefined || originalSlug === slug) {
    return;
  }

  const getPreviewPathArgs = { collection, locale };

  // Use the original content, as fields referenced by the `preview_path` template, such as a date,
  // may have been edited along with the slug
  const previousPath = normalizePath(
    getPreviewPath({
      ...getPreviewPathArgs,
      slug: originalSlug,
      path: originalPath,
      content: originalContent,
    }),
  );

  const currentPath = normalizePath(getPreviewPath({ ...getPreviewPathArgs, slug, path, content }));

  // The `preview_path` template may not contain the slug at all, in which case the path is
  // unchanged and an alias would just point the page at itself
  if (previousPath === undefined || previousPath === currentPath) {
    return;
  }

  const keyPaths = getAliasKeyPaths(content, aliasesKey);
  const value = content[aliasesKey];

  const isEmpty =
    value === undefined ||
    value === null ||
    (Array.isArray(value) && !value.length) ||
    value === '';

  // Leave an unsupported shape, such as a plain string, untouched
  if (!keyPaths.length && !isEmpty) {
    return;
  }

  const aliases = keyPaths
    .map((keyPath) => content[keyPath])
    .filter((alias) => typeof alias === 'string' && !!alias.trim())
    // Avoid a duplicate as well as an alias pointing at the entry’s own current path, which both
    // Hugo and Zola report as a conflict
    .filter((alias) => alias !== previousPath && alias !== currentPath);

  removeAliases(content, aliasesKey);

  [...aliases, previousPath].forEach((alias, index) => {
    content[`${aliasesKey}.${index}`] = alias;
  });
};
