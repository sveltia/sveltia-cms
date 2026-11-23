import { isObject } from '@sveltia/utils/object';

import { DATE_TIME_FIELDS, UUID_TYPES } from '$lib/services/common/template/constants';
import { getTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { parseTransformations } from '$lib/services/common/transformations';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
import { usesSingleFileStructure } from '$lib/services/contents/i18n/config';

/**
 * @import {
 * InternalCollection,
 * InternalEntryCollection,
 * InternalSlugOptions,
 * } from '$lib/types/private';
 * @import {
 * Collection,
 * CollectionSlugOptions,
 * EntryCollection,
 * SlugEditableStage,
 * } from '$lib/types/public';
 */

/**
 * Legacy template tag that shows the slug editor for the default locale.
 * @todo Remove the support prior to the 1.0 release.
 */
export const LEGACY_SLUG_EDITOR_TAG = '{{fields._slug}}';

/**
 * Legacy template tag that shows the slug editor for all locales.
 * @todo Remove the support prior to the 1.0 release.
 */
export const LEGACY_LOCALIZED_SLUG_EDITOR_TAG = '{{fields._slug | localize}}';

/**
 * Get the slug template configured for an entry collection, either as the `slug` option itself or
 * as its `template` property.
 * @param {EntryCollection} collection Entry collection.
 * @returns {string | undefined} Template, or `undefined` if not configured.
 */
export const getConfiguredSlugTemplate = ({ slug }) => {
  if (typeof slug === 'string') {
    return slug;
  }

  if (isObject(slug) && typeof slug.template === 'string') {
    return slug.template;
  }

  return undefined;
};

/**
 * Check whether the given slug template contains one of the legacy slug editor tags.
 * @param {string | undefined} template Slug template.
 * @returns {boolean} Result.
 */
export const hasLegacySlugEditorTag = (template) =>
  !!template?.includes(LEGACY_SLUG_EDITOR_TAG) ||
  !!template?.includes(LEGACY_LOCALIZED_SLUG_EDITOR_TAG);

/**
 * Get the stages at which the slug can be edited.
 * @param {CollectionSlugOptions['editable']} editable The `editable` option. Default: `true`.
 * @returns {SlugEditableStage[]} Stages.
 */
const getEditableStages = (editable = true) => {
  if (typeof editable === 'boolean') {
    return editable ? ['create', 'update'] : [];
  }

  // A value of another type is reported against the JSON schema
  return Array.isArray(editable) ? editable : [];
};

/**
 * Get the normalized slug options of an entry collection. The `slug` option can be a template
 * string, which may contain the legacy slug editor tags, or an object with the template and the
 * slug editor options.
 * @param {Collection | InternalCollection} collection Collection. Only an entry collection has
 * slug options; for another collection, the defaults are returned.
 * @returns {InternalSlugOptions} Normalized options.
 * @see https://github.com/sveltia/sveltia-cms/issues/999
 * @see https://github.com/sveltia/sveltia-cms/issues/1072
 */
export const getSlugOptions = (collection) => {
  const { slug, file } = /** @type {EntryCollection} */ (collection);
  const identifierField = getIdentifierFieldName(/** @type {EntryCollection} */ (collection));
  /** @type {CollectionSlugOptions} */
  const options = isObject(slug) ? /** @type {CollectionSlugOptions} */ (slug) : {};
  const configuredTemplate = getConfiguredSlugTemplate(/** @type {EntryCollection} */ (collection));
  // An entry stored in a file with the other entries of the collection is told by its position, so
  // there’s no slug to edit
  const stages = typeof file === 'string' ? [] : getEditableStages(options.editable);
  const update = stages.includes('update');

  // A numbered slug isn’t made from a template, so a configured one is ignored, and the slug editor
  // is prefilled with the number rather than having to be filled in. An entry stored in a file with
  // the other entries has no slug to number
  if (options.auto_increment === true && typeof file !== 'string') {
    return {
      template: '',
      editorRequired: false,
      editorValueIsSlug: true,
      editable: { create: stages.includes('create'), update },
      localized: options.i18n === true,
      autoIncrement: true,
      hint: options.hint,
      pattern: options.pattern,
    };
  }

  const legacyLocalized = !!configuredTemplate?.includes(LEGACY_LOCALIZED_SLUG_EDITOR_TAG);
  const legacy = hasLegacySlugEditorTag(configuredTemplate);
  const create = legacy || stages.includes('create');
  const localized = legacyLocalized || options.i18n === true;

  // The slug comes from the slug editor alone when it’s explicitly made editable on creation
  // without a template. Otherwise, the slug editor, which is shown by default, is prefilled with
  // the slug the template fills, which defaults to the identifier field
  const editorOnly =
    configuredTemplate === undefined && options.editable !== undefined && stages.includes('create');

  const template =
    configuredTemplate ??
    (editorOnly
      ? localized
        ? LEGACY_LOCALIZED_SLUG_EDITOR_TAG
        : LEGACY_SLUG_EDITOR_TAG
      : `{{${identifierField}}}`);

  const editorRequired = hasLegacySlugEditorTag(template);

  return {
    template,
    editorRequired,
    // A legacy template can put the slug editor’s value among other tags, e.g.
    // `{{year}}-{{fields._slug}}`
    editorValueIsSlug:
      !editorRequired ||
      [LEGACY_SLUG_EDITOR_TAG, LEGACY_LOCALIZED_SLUG_EDITOR_TAG].includes(template),
    editable: { create, update },
    localized,
    autoIncrement: false,
    hint: options.hint,
    pattern: options.pattern,
  };
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
export const getLocalizingKeyPaths = (collection) => {
  const { template, localized } = getSlugOptions(collection);
  /** @type {Set<string>} */
  const keyPaths = new Set();

  getTemplateTags(template).forEach(({ content: placeholder }) => {
    // Leave out the transformations, e.g. `upper` in `{{title | upper | localize}}`. The `localize`
    // flag can come anywhere among them; it’s a no-op when the template is filled
    const { value, transformations } = parseTransformations(placeholder);
    const keyPath = stripFieldTagPrefix(value);

    if (transformations.some(({ method }) => method === 'localize')) {
      keyPaths.add(keyPath);
    } else if (localized && !NON_FIELD_TAGS.includes(keyPath)) {
      keyPaths.add(keyPath);
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
    _i18n: { i18nEnabled, structureMap },
  } = collection;

  return (
    // A monolingual collection has only one locale, so there’s nothing to localize
    i18nEnabled &&
    !usesSingleFileStructure(structureMap) &&
    collection._type === 'entry' &&
    (getSlugOptions(collection).localized || !!getLocalizingKeyPaths(collection).length)
  );
};
