import { serializeContent } from '$lib/services/contents/draft/save/serialize';

/**
 * @import { Entry, InternalCollection, InternalCollectionFile } from '$lib/types/private';
 */

/**
 * Build the file content for a single-file entry, taking i18n single-file structures into account.
 * For `single_file_default_root`, the default locale’s fields are written at the root level and
 * non-default locales are nested under their locale key.
 * @param {object} args Arguments.
 * @param {InternalCollection | InternalCollectionFile} args.config Collection or collection file
 * holding the i18n configuration.
 * @param {Entry} args.entry Entry whose locales have already been updated.
 * @param {any} args.draft Entry draft, or a synthetic draft holding the properties read by
 * {@link serializeContent}.
 * @returns {Record<string, any>} Serializable content object passed to `formatEntryFile()`.
 */
export const buildSingleFileContent = ({ config, entry, draft }) => {
  const {
    _i18n: { i18nEnabled, defaultLocale, structureMap: { i18nSingleFileDefaultRoot } = {} },
  } = config;

  if (!i18nEnabled) {
    return serializeContent({
      draft,
      locale: '_default',
      valueMap: entry.locales[defaultLocale].content,
    });
  }

  const localeContents = Object.fromEntries(
    Object.entries(entry.locales)
      .filter(([, le]) => !!le.content)
      .map(([locale, le]) => [locale, serializeContent({ draft, locale, valueMap: le.content })]),
  );

  if (i18nSingleFileDefaultRoot) {
    // Remove `lang` from default content to avoid stale/duplicate values; it’s always
    // auto-generated from the configured locales.
    const { lang: _lang, ...defaultContent } = localeContents[defaultLocale] ?? {};

    const nonDefaultContent = Object.fromEntries(
      Object.entries(localeContents).filter(([locale]) => locale !== defaultLocale),
    );

    return {
      // Add `lang` field at the root level as per Lume’s convention for single-file i18n
      // @see https://lume.land/plugins/multilanguage/#multilanguage-pages-from-a-single-file
      lang: [defaultLocale, ...Object.keys(nonDefaultContent)],
      ...defaultContent,
      ...nonDefaultContent,
    };
  }

  // `i18nSingleFile`: nested locale keys
  return localeContents;
};
