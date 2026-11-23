import { isObject } from '@sveltia/utils/object';

import { normalizeTemplateTags } from '$lib/services/common/template/normalize';
import { COMPARISON_OPERATORS } from '$lib/services/common/view';
import { getSubFields } from '$lib/services/config/parser/utils/fields';

/**
 * @import { CmsConfig, EditorComponentDefinition, Field } from '$lib/types/public';
 */

/**
 * Options of a collection, a collection file or a field that hold an asset folder path, which can
 * contain template tags.
 */
export const FOLDER_OPTIONS = ['media_folder', 'public_folder'];

/**
 * Options of each field type, besides {@link FOLDER_OPTIONS}, that hold a template. A field type’s
 * other string options, e.g. the `default` option of a String field, are content and left as is.
 * @type {Record<string, string[]>}
 */
const FIELD_TEMPLATE_OPTIONS = {
  compute: ['value'],
  datetime: ['default'],
  hidden: ['default'],
  list: ['summary'],
  object: ['summary'],
  relation: ['value_field', 'display_fields', 'search_fields'],
};

/**
 * Options of a view filter or group that match or compare a field value with another value, which
 * can contain a template tag like `{{now}}`. The `empty` operator takes a boolean, which
 * {@link normalizeOptions} leaves as is.
 */
const VIEW_COMPARISON_OPTIONS = ['pattern', ...COMPARISON_OPERATORS];

/**
 * Normalize the template tags in the given options of an object, in place. An option can be a
 * string or a list of strings; any other value is left as is.
 * @param {any} target Object holding the options. Ignored if it’s not an object.
 * @param {string[]} options Option names.
 */
const normalizeOptions = (target, options) => {
  if (!isObject(target)) {
    return;
  }

  options.forEach((option) => {
    const value = target[option];

    if (typeof value === 'string') {
      target[option] = normalizeTemplateTags(value);
    } else if (Array.isArray(value)) {
      target[option] = value.map((item) =>
        typeof item === 'string' ? normalizeTemplateTags(item) : item,
      );
    }
  });
};

/**
 * Normalize the `filename_template` option of the media libraries configured in an object: the
 * root config or a field.
 * @param {any} target Object holding the `media_libraries` or legacy `media_library` option.
 */
const normalizeMediaLibraryTemplates = (target) => {
  const { media_libraries: libraries, media_library: legacyLibrary } = target;

  if (isObject(libraries)) {
    Object.values(libraries).forEach((library) => {
      normalizeOptions(library?.config, ['filename_template']);
    });
  }

  normalizeOptions(legacyLibrary?.config, ['filename_template']);
};

/**
 * Normalize the template tags in the `canonical_slug` i18n option of an object: the root config, a
 * collection or a collection file.
 * @param {any} target Object holding the `i18n` option.
 */
const normalizeI18nTemplates = (target) => {
  normalizeOptions(target.i18n?.canonical_slug, ['value']);
};

/**
 * Normalize the template tags in the options of the given fields and their subfields, in place.
 * @param {any} fields Field list. Ignored if it’s not an array.
 */
export const normalizeFieldTemplates = (fields) => {
  if (!Array.isArray(fields)) {
    return;
  }

  fields.forEach((field) => {
    if (!isObject(field)) {
      return;
    }

    const { widget = 'string', filters, types } = field;

    normalizeOptions(field, [...FOLDER_OPTIONS, ...(FIELD_TEMPLATE_OPTIONS[widget] ?? [])]);
    normalizeMediaLibraryTemplates(field);

    // A variable type of a List or Object field can have a `summary` of its own
    if (Array.isArray(types)) {
      types.forEach((type) => normalizeOptions(type, ['summary']));
    }

    if (widget === 'relation' && Array.isArray(filters)) {
      filters.forEach((filter) => normalizeOptions(filter, ['values']));
    }

    normalizeFieldTemplates(getSubFields(/** @type {Field} */ (field)));
  });
};

/**
 * Normalize the template tags in the options of a collection file or a singleton, in place.
 * @param {any} file Collection file.
 */
const normalizeCollectionFileTemplates = (file) => {
  if (!isObject(file)) {
    return;
  }

  normalizeOptions(file, ['file', 'summary', 'preview_path', ...FOLDER_OPTIONS]);
  normalizeI18nTemplates(file);
  normalizeFieldTemplates(file.fields);
};

/**
 * Normalize the template tags in the view filters or groups of a collection, in place.
 * @param {any} views The `view_filters` or `view_groups` option: a list of filters or groups, or an
 * object holding the list in the given property.
 * @param {'filters' | 'groups'} listName Name of the property holding the list.
 */
const normalizeViewTemplates = (views, listName) => {
  const list = Array.isArray(views) ? views : views?.[listName];

  if (Array.isArray(list)) {
    list.forEach((view) => normalizeOptions(view, VIEW_COMPARISON_OPTIONS));
  }
};

/**
 * Normalize the template tags in the options of a collection, in place.
 * @param {any} collection Collection.
 */
const normalizeCollectionTemplates = (collection) => {
  if (!isObject(collection)) {
    return;
  }

  const { slug, nested, table_columns: tableColumns, index_file: indexFile, files } = collection;

  // `folder` and `file` (an entry collection stored in one file) can contain `{{locale}}`
  normalizeOptions(collection, [
    'folder',
    'file',
    'slug',
    'path',
    'summary',
    'preview_path',
    'table_columns',
    'summary_fields',
    // A file path among key paths, e.g. `/images/{{slug}}.webp`
    'thumbnail',
    ...FOLDER_OPTIONS,
  ]);
  normalizeOptions(slug, ['template']);
  normalizeOptions(nested, ['summary']);
  normalizeI18nTemplates(collection);
  normalizeViewTemplates(collection.view_filters, 'filters');
  normalizeViewTemplates(collection.view_groups, 'groups');

  // A column can also be an object with the template in its `field` option
  if (Array.isArray(tableColumns)) {
    tableColumns.forEach((column) => normalizeOptions(column, ['field']));
  }

  normalizeFieldTemplates(collection.fields);

  // An index file can have a `summary` and fields of its own
  if (isObject(indexFile)) {
    normalizeOptions(indexFile, ['summary']);
    normalizeFieldTemplates(indexFile.fields);
  }

  if (Array.isArray(files)) {
    files.forEach(normalizeCollectionFileTemplates);
  }
};

/**
 * Normalize the template tags in the options of the given configuration that hold a template, in
 * place, so spaces inside a tag, e.g. `{{ slug }}`, and around a pipe don’t matter anywhere. See
 * {@link normalizeTemplateTags}.
 * @param {CmsConfig} config Configuration. It must be a copy of the one given by the user.
 * @returns {CmsConfig} The same configuration.
 */
export const normalizeConfigTemplates = (config) => {
  /** @type {any} */
  const { backend, collections, singletons, asset_collections: assetCollections } = config;

  normalizeOptions(config, FOLDER_OPTIONS);
  normalizeMediaLibraryTemplates(config);
  normalizeI18nTemplates(config);

  if (isObject(backend?.commit_messages)) {
    normalizeOptions(backend.commit_messages, Object.keys(backend.commit_messages));
  }

  if (Array.isArray(collections)) {
    collections.forEach(normalizeCollectionTemplates);
  }

  if (Array.isArray(singletons)) {
    singletons.forEach(normalizeCollectionFileTemplates);
  }

  if (Array.isArray(assetCollections)) {
    assetCollections.forEach((collection) => normalizeOptions(collection, FOLDER_OPTIONS));
  }

  return config;
};

/**
 * Normalize the template tags in the `summary` option and the fields of an editor component
 * definition, in place.
 * @param {EditorComponentDefinition} definition Definition.
 */
export const normalizeEditorComponentTemplates = (definition) => {
  normalizeOptions(definition, ['summary']);
  normalizeFieldTemplates(definition.fields);
};
