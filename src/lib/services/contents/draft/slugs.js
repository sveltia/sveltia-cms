import { fillTemplate } from '$lib/services/common/template';
import { getIndexFile } from '$lib/services/contents/collection/index-file';

/**
 * @import {
 * EntryDraft,
 * EntrySlugVariants,
 * FillTemplateOptions,
 * InternalEntryCollection,
 * LocaleSlugMap,
 * } from '$lib/types/private';
 */

/**
 * Get base options for {@link fillTemplate}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @returns {FillTemplateOptions} Options.
 */
export const getFillSlugOptions = ({ draft }) => {
  const { collection, collectionFile, currentSlugs, currentValues, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  return {
    collection: /** @type {InternalEntryCollection} */ (collection),
    content: {
      ...currentValues[defaultLocale],
      // Slug candidate for the default locale
      _slug: currentSlugs?.[defaultLocale] ?? currentSlugs?._,
    },
    isIndexFile,
  };
};

/**
 * Get the localized slug for the given locale.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.locale Locale.
 * @param {string[]} args.localizingKeyPaths List of key paths that the value will be localized.
 * @returns {string} Localized slug.
 */
export const getLocalizedSlug = ({ draft, locale, localizingKeyPaths }) => {
  const { isNew, collection, collectionFile, currentSlugs, currentValues, isIndexFile } = draft;
  const { _type } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = _type === 'entry' ? collection : {};

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const _slug = currentSlugs?.[locale] ?? currentSlugs?._;

  if (isNew) {
    return fillTemplate(slugTemplate, {
      collection,
      locale,
      content: {
        // Merge the default locale content and localized content
        ...currentValues[defaultLocale],
        ...Object.fromEntries(
          localizingKeyPaths.map((keyPath) => [keyPath, currentValues[locale]?.[keyPath]]),
        ),
        // Slug candidate for the current locale
        _slug,
      },
      isIndexFile,
    });
  }

  return /** @type {string} */ (_slug);
};

/**
 * Get the localized slug map. This only applies when the i18n structure is multiple files or
 * folders, and the slug template contains the `localize` flag, e.g. `{{title | localize}}`.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @returns {LocaleSlugMap | undefined} Localized slug map.
 */
export const getLocalizedSlugs = ({ draft, defaultLocaleSlug }) => {
  const { collection, collectionFile, currentLocales } = draft;
  const { _type } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = _type === 'entry' ? collection : {};

  const {
    _i18n: {
      defaultLocale,
      structureMap: { i18nSingleFile },
    },
  } = collectionFile ?? collection;

  /**
   * List of key paths that the value will be localized.
   */
  const localizingKeyPaths = [...slugTemplate.matchAll(/{{((?:fields\.)?.+?)( \| localize)?}}/g)]
    .filter(([, , localize]) => !!localize)
    .map(([, keyPath]) => keyPath);

  if (i18nSingleFile || !localizingKeyPaths.length) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(currentLocales).map(([locale]) => {
      const slug =
        locale === defaultLocale
          ? defaultLocaleSlug
          : getLocalizedSlug({ draft, locale, localizingKeyPaths });

      return [locale, slug];
    }),
  );
};

/**
 * Get the canonical slug to be added to the content of each file when the slug is localized. It
 * helps Sveltia CMS and some frameworks to link localized files. The default property name is
 * `translationKey` used in Hugo’s multilingual support, and the default value is the default
 * locale’s slug.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {LocaleSlugMap | undefined} args.localizedSlugs Localized slug map.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for {@link fillTemplate}.
 * @returns {string | undefined} Canonical slug.
 * @see https://sveltiacms.app/en/docs/i18n#localizing-entry-slugs
 * @see https://gohugo.io/content-management/multilingual/#bypassing-default-linking
 */
export const getCanonicalSlug = ({ draft, defaultLocaleSlug, localizedSlugs, fillSlugOptions }) => {
  if (!localizedSlugs) {
    return undefined;
  }

  const { collection, collectionFile } = draft;

  const {
    _i18n: {
      canonicalSlug: { value: canonicalSlugTemplate },
    },
  } = collectionFile ?? collection;

  if (canonicalSlugTemplate === '{{slug}}') {
    return defaultLocaleSlug;
  }

  return fillTemplate(canonicalSlugTemplate, {
    ...fillSlugOptions,
    currentSlug: defaultLocaleSlug,
  });
};

/**
 * Determine entry slugs.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @returns {EntrySlugVariants} Slugs.
 */
export const getSlugs = ({ draft }) => {
  const { isNew, collection, collectionFile, fileName, currentSlugs, isIndexFile } = draft;
  const { _type } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = _type === 'entry' ? collection : {};

  if (isIndexFile) {
    return {
      defaultLocaleSlug: /** @type {string} */ (getIndexFile(collection)?.name),
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    };
  }

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const fillSlugOptions = getFillSlugOptions({ draft });

  const defaultLocaleSlug =
    fileName ??
    (isNew
      ? fillTemplate(slugTemplate, fillSlugOptions)
      : /** @type {string} */ (currentSlugs?.[defaultLocale] ?? currentSlugs?._));

  const localizedSlugs = getLocalizedSlugs({ draft, defaultLocaleSlug });

  const canonicalSlug = getCanonicalSlug({
    draft,
    defaultLocaleSlug,
    localizedSlugs,
    fillSlugOptions,
  });

  return { defaultLocaleSlug, localizedSlugs, canonicalSlug };
};
