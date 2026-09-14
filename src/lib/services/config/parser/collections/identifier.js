import { hasField } from '$lib/services/config/parser/utils/fields';
import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { EntryCollection } from '$lib/types/public';
 */

/**
 * Name of the field an entry is identified by when the `identifier_field` option isn’t set. The
 * default slug template is `{{title}}` accordingly.
 */
const DEFAULT_IDENTIFIER_FIELD = 'title';

/**
 * Check the field an entry collection identifies its entries by. The field names the entry in the
 * list and, unless the `slug` option says otherwise, provides the slug of a new entry, so a field
 * that isn’t there is not a problem the runtime can report: the summary falls back to another
 * field, and a slug template tag that resolves to nothing falls back to a random ID, which is hard
 * to tell from a working configuration until the content folder fills up with such file names.
 * @param {object} args Arguments.
 * @param {EntryCollection} args.collection Collection config to check.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 * @see https://decapcms.org/docs/configuration-options/#identifier_field
 */
export const checkIdentifierField = ({ collection, context, collectors }) => {
  const { create = true, fields, identifier_field: identifierField, slug } = collection;

  // A collection without fields is reported as such, and no field can be found in it anyway
  if (!fields?.length) {
    return;
  }

  // A field named by the option is a mistake, most likely a typo, wherever the collection uses it
  if (identifierField !== undefined) {
    if (typeof identifierField === 'string' && !hasField(fields, identifierField)) {
      addMessage({
        strKey: 'invalid_identifier_field',
        values: { name: identifierField },
        context,
        collectors,
      });
    }

    return;
  }

  // Without the option, the default is only relied on to make the slug of a new entry, which a
  // custom slug template does its own way. Netlify/Decap CMS refuses to save such an entry, but
  // its collections can’t be created in by default, so a configuration that worked there may
  // simply never have needed the field; it’s a warning rather than an error for that reason
  if (create && slug === undefined && !hasField(fields, DEFAULT_IDENTIFIER_FIELD)) {
    addMessage({
      type: 'warning',
      strKey: 'missing_identifier_field',
      values: { name: DEFAULT_IDENTIFIER_FIELD },
      context,
      collectors,
    });
  }
};
