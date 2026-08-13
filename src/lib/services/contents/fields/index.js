/**
 * @import { BuiltInFieldType } from '$lib/types/public';
 */

/**
 * List of built-in field types.
 * @type {BuiltInFieldType[]}
 */
export const BUILTIN_FIELD_TYPES = [
  'boolean',
  'code',
  'color',
  'compute',
  'datetime',
  'file',
  'hidden',
  'image',
  'keyvalue',
  'list',
  'map',
  'markdown',
  'number',
  'object',
  'relation',
  'richtext',
  'select',
  'string',
  'text',
  'uuid',
];

/**
 * List of field types that support a simple value: boolean, number or string.
 * @type {string[]}
 */
export const SIMPLE_VALUE_FIELD_TYPES = [
  'boolean',
  'color',
  'compute',
  'datetime',
  'map',
  'markdown',
  'number',
  'richtext',
  'string',
  'text',
  'uuid',
];

/**
 * List of field types whose value is always a string. Unlike the Number, Select and Relation field
 * types, which accept numeric values, anything stored in these fields can be safely stringified.
 * @type {string[]}
 */
export const STRING_VALUE_FIELD_TYPES = SIMPLE_VALUE_FIELD_TYPES.filter(
  (type) => !['boolean', 'number'].includes(type),
);

/**
 * List of field types that support media files.
 * @type {string[]}
 */
export const MEDIA_FIELD_TYPES = ['file', 'image'];

/**
 * List of field types that support the `multiple` option.
 * @type {string[]}
 */
export const MULTI_VALUE_FIELD_TYPES = [...MEDIA_FIELD_TYPES, 'relation', 'select'];

/**
 * List of field types that support the `min` and `max` options.
 * @type {string[]}
 */
export const MIN_MAX_VALUE_FIELD_TYPES = [
  ...MULTI_VALUE_FIELD_TYPES,
  'datetime',
  'keyvalue',
  'list',
  'number',
];
