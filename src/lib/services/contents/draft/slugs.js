import { fillTemplate } from '$lib/services/common/template';
import { DATE_TIME_FIELDS, UUID_TYPES } from '$lib/services/common/template/constants';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getSlugOptions, LEGACY_SLUG_EDITOR_TAG } from '$lib/services/contents/collection/slug';

/**
 * @import {
 * EntryDraft,
 * EntryFileMap,
 * EntrySlugVariants,
 * FillTemplateOptions,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalEntryCollection,
 * LocaleSlugMap,
 * } from '$lib/types/private';
 */

/**
 * Replace blob URLs in the value map with the actual file names (without extension) so that asset
 * fields (image, file) can be used in slug templates.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {EntryFileMap} files Draft file map keyed by blob URL.
 * @returns {FlattenedEntryContent} Value map with blob URLs replaced.
 * @see https://github.com/sveltia/sveltia-cms/issues/710
 */
export const resolveBlobURLs = (valueMap, files) => {
  const resolved = { ...valueMap };

  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('blob:') && files[value]) {
      resolved[key] = files[value].file.name.replace(/\.[^.]+$/, '');
    }
  });

  return resolved;
};

/**
 * Random values generated for each entry draft’s slug. See {@link getRandomValues}.
 * @type {WeakMap<EntryDraft, Map<string, string>>}
 */
const randomValueMaps = new WeakMap();

/**
 * Get the random values generated so far for the given draft’s slug, such as the one for a
 * `{{uuid}}` tag. A new entry’s slug is shown while it’s being edited, so reusing them keeps the
 * slug from changing on every keystroke, and the saved slug the same as the one shown.
 * @param {EntryDraft} draft Entry draft.
 * @returns {Map<string, string>} Random values keyed by what they stand for.
 */
export const getRandomValues = (draft) => {
  let randomValues = randomValueMaps.get(draft);

  if (!randomValues) {
    randomValues = new Map();
    randomValueMaps.set(draft, randomValues);
  }

  return randomValues;
};

/**
 * Get base options for {@link fillTemplate}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @returns {FillTemplateOptions} Options.
 */
export const getFillSlugOptions = ({ draft }) => {
  const { collection, collectionFile, currentSlugs, currentValues, files, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  return {
    collection: /** @type {InternalEntryCollection} */ (collection),
    content: {
      ...resolveBlobURLs(currentValues[defaultLocale], files),
      // Slug candidate for the default locale
      _slug: currentSlugs?.[defaultLocale] ?? currentSlugs?._,
    },
    locale: defaultLocale,
    isIndexFile,
    randomValues: getRandomValues(draft),
  };
};

/**
 * Get the slug template to fill for a new entry in the given locale. A slug editor filled in by the
 * user takes over from the configured template, unless the template itself takes the slug from the
 * slug editor.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.locale Locale.
 * @param {boolean} [args.templateOnly] Whether to ignore a filled-in slug editor, to get the slug
 * the template fills.
 * @returns {string} Slug template, e.g. `{{title}}`. An empty string for a non-entry collection,
 * whose entry slug is the file name.
 */
export const getSlugTemplate = ({ draft, locale, templateOnly = false }) => {
  const { collection, currentSlugs, slugEditor } = draft;

  if (collection._type !== 'entry') {
    return '';
  }

  const { template, editorRequired } = getSlugOptions(collection);
  const editorValue = currentSlugs?.[locale] ?? currentSlugs?._;

  if (!templateOnly && !editorRequired && slugEditor[locale] && editorValue?.trim()) {
    return LEGACY_SLUG_EDITOR_TAG;
  }

  return template;
};

/**
 * Get the localized slug for the given locale.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.locale Locale.
 * @param {string[]} args.localizingKeyPaths List of key paths that the value will be localized.
 * @param {boolean} [args.templateOnly] See {@link getSlugTemplate}.
 * @returns {string} Localized slug.
 */
export const getLocalizedSlug = ({ draft, locale, localizingKeyPaths, templateOnly = false }) => {
  const {
    isNew,
    collection,
    collectionFile,
    originalLocales,
    currentSlugs,
    currentValues,
    files,
    isIndexFile,
  } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const _slug = currentSlugs?.[locale] ?? currentSlugs?._;

  // When creating a new entry or enabling a locale for an existing entry, we need to fill the slug
  // template to generate the initial slug for the new locale. For other cases, we keep the existing
  // slug to avoid changing URLs unexpectedly.
  if (isNew || !originalLocales[locale]) {
    return fillTemplate(getSlugTemplate({ draft, locale, templateOnly }), {
      collection,
      locale,
      content: {
        // Merge the default locale content and localized content
        ...resolveBlobURLs(currentValues[defaultLocale], files),
        ...resolveBlobURLs(
          Object.fromEntries(
            localizingKeyPaths.map((keyPath) => [keyPath, currentValues[locale]?.[keyPath]]),
          ),
          files,
        ),
        // Slug candidate for the current locale
        _slug,
      },
      isIndexFile,
      randomValues: getRandomValues(draft),
    });
  }

  return /** @type {string} */ (_slug);
};

/**
 * Template tags a slug template can use that don’t refer to a field, and therefore can’t be
 * localized.
 * @type {string[]}
 */
const NON_FIELD_TAGS = [...DATE_TIME_FIELDS, ...Object.keys(UUID_TYPES), 'slug'];

/**
 * Get the key paths of the fields whose values are localized in the slug, which are the tags in the
 * slug template carrying the `localize` flag, e.g. `{{title | localize}}`. With the slug’s `i18n`
 * option enabled, every field tag in the template is localized.
 * @param {InternalEntryCollection} collection Collection.
 * @returns {string[]} Key paths. An empty array if the slug isn’t localized.
 */
const getLocalizingKeyPaths = (collection) => {
  const { template, localized } = getSlugOptions(collection);
  /** @type {Set<string>} */
  const keyPaths = new Set();

  [...template.matchAll(/{{((?:fields\.)?.+?)( \| localize)?}}/g)].forEach(([, tag, localize]) => {
    if (localize) {
      keyPaths.add(tag.replace(/^fields\./, ''));
    } else if (localized) {
      // Leave out the transformations, e.g. `upper` in `{{title | upper}}`
      const [keyPath] = tag.replace(/^fields\./, '').split(' | ');

      if (!NON_FIELD_TAGS.includes(keyPath)) {
        keyPaths.add(keyPath);
      }
    }
  });

  return [...keyPaths];
};

/**
 * Check whether the entries in the given collection get a slug of their own for each locale, which
 * is the case when i18n is enabled with the multiple files or folders structure, and either the
 * slug’s `i18n` option is enabled or the slug template contains the `localize` flag, e.g.
 * `{{title | localize}}`.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result.
 * @see https://sveltiacms.app/en/docs/i18n/slugs#localizing-entry-slugs
 */
export const hasLocalizedSlugs = (collection) => {
  const {
    _i18n: {
      i18nEnabled,
      structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot },
    },
  } = collection;

  return (
    // A monolingual collection has only one locale, so there’s nothing to localize
    i18nEnabled &&
    !i18nSingleFile &&
    !i18nSingleFileDefaultRoot &&
    collection._type === 'entry' &&
    (getSlugOptions(collection).localized || !!getLocalizingKeyPaths(collection).length)
  );
};

/**
 * Get the localized slug map. This only applies when the i18n structure is multiple files or
 * folders, and the slug template contains the `localize` flag, e.g. `{{title | localize}}`.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {boolean} [args.templateOnly] See {@link getSlugTemplate}.
 * @returns {LocaleSlugMap | undefined} Localized slug map.
 */
export const getLocalizedSlugs = ({ draft, defaultLocaleSlug, templateOnly = false }) => {
  const { collection, collectionFile, currentLocales } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  // A file/singleton collection has no slug template, so there is nothing to localize
  if (collectionFile || !hasLocalizedSlugs(collection)) {
    return undefined;
  }

  /**
   * List of key paths that the value will be localized.
   */
  const localizingKeyPaths = getLocalizingKeyPaths(
    /** @type {InternalEntryCollection} */ (collection),
  );

  return Object.fromEntries(
    Object.entries(currentLocales).map(([locale]) => {
      const slug =
        locale === defaultLocale
          ? defaultLocaleSlug
          : getLocalizedSlug({ draft, locale, localizingKeyPaths, templateOnly });

      return [locale, slug];
    }),
  );
};

/**
 * Get the canonical slug to be added to the content of each file when the slug is localized. It
 * helps Sveltia CMS and some frameworks to link localized files. The default property name is
 * `translationKey` used in Hugo’s multilingual support, and the default value is the default
 * locale’s slug.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {LocaleSlugMap | undefined} args.localizedSlugs Localized slug map.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for {@link fillTemplate}.
 * @returns {string | undefined} Canonical slug.
 * @see https://sveltiacms.app/en/docs/i18n/slugs#localizing-entry-slugs
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
 * @param {boolean} [args.templateOnly] Whether to ignore a filled-in slug editor, to get the slugs
 * the template fills for a new entry.
 * @returns {EntrySlugVariants} Slugs.
 */
export const getSlugs = ({ draft, templateOnly = false }) => {
  const { isNew, collection, collectionFile, fileName, currentSlugs, isIndexFile } = draft;

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
      ? fillTemplate(
          getSlugTemplate({ draft, locale: defaultLocale, templateOnly }),
          fillSlugOptions,
        )
      : /** @type {string} */ (currentSlugs?.[defaultLocale] ?? currentSlugs?._));

  const localizedSlugs = getLocalizedSlugs({ draft, defaultLocaleSlug, templateOnly });

  const canonicalSlug = getCanonicalSlug({
    draft,
    defaultLocaleSlug,
    localizedSlugs,
    fillSlugOptions,
  });

  return { defaultLocaleSlug, localizedSlugs, canonicalSlug };
};
