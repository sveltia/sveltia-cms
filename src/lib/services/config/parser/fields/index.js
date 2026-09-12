import { parseDateTimeFieldConfig } from '$lib/services/config/parser/fields/datetime';
import { parseFileFieldConfig } from '$lib/services/config/parser/fields/file';
import { parseListFieldConfig } from '$lib/services/config/parser/fields/list';
import { parseNumberFieldConfig } from '$lib/services/config/parser/fields/number';
import { parseObjectFieldConfig } from '$lib/services/config/parser/fields/object';
import { fieldParsers } from '$lib/services/config/parser/fields/registry';
import { parseRelationFieldConfig } from '$lib/services/config/parser/fields/relation';
import { parseRichTextFieldConfig } from '$lib/services/config/parser/fields/rich-text';

export { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields/registry';

// Register the built-in field parsers. See `registry.js` for why they aren’t imported there.
Object.assign(fieldParsers, {
  datetime: parseDateTimeFieldConfig,
  file: parseFileFieldConfig,
  image: parseFileFieldConfig, // alias
  list: parseListFieldConfig,
  markdown: parseRichTextFieldConfig, // alias
  number: parseNumberFieldConfig,
  object: parseObjectFieldConfig,
  relation: parseRelationFieldConfig,
  richtext: parseRichTextFieldConfig,
});
