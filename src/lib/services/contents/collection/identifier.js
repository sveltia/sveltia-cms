/**
 * Name of the field an entry is identified by when the `identifier_field` option isn’t set. The
 * default slug template is `{{title}}` accordingly.
 */
export const DEFAULT_IDENTIFIER_FIELD = 'title';

/**
 * Get the name of the field an entry collection identifies its entries by: the `identifier_field`
 * option, or `title` by default.
 * @param {{ identifier_field?: string } | undefined} collection Entry collection, or its raw
 * configuration. `undefined` for anything that isn’t an entry collection.
 * @returns {string} Field name.
 * @see https://decapcms.org/docs/configuration-options/#identifier_field
 */
export const getIdentifierFieldName = (collection) =>
  collection?.identifier_field ?? DEFAULT_IDENTIFIER_FIELD;
