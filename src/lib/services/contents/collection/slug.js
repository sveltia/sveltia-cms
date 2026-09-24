import { isObject } from '@sveltia/utils/object';

/**
 * @import { InternalCollection, InternalSlugOptions } from '$lib/types/private';
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
 */
export const getSlugOptions = (collection) => {
  const { slug, identifier_field: identifierField = 'title' } = /** @type {EntryCollection} */ (
    collection
  );

  /** @type {CollectionSlugOptions} */
  const options = isObject(slug) ? /** @type {CollectionSlugOptions} */ (slug) : {};
  const configuredTemplate = getConfiguredSlugTemplate(/** @type {EntryCollection} */ (collection));
  const stages = getEditableStages(options.editable);
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
    editable: { create, update: stages.includes('update') },
    localized,
    hint: options.hint,
    pattern: options.pattern,
  };
};
