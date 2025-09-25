/**
 * @import { BuiltInWidgetName } from '$lib/types/public';
 */

/**
 * List of built-in widget names.
 * @type {BuiltInWidgetName[]}
 */
export const BUILTIN_WIDGETS = [
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
  'select',
  'string',
  'text',
  'uuid',
];

/**
 * List of widgets that support a simple value: boolean, number or string.
 * @type {string[]}
 */
export const SIMPLE_VALUE_WIDGETS = [
  'boolean',
  'color',
  'compute',
  'datetime',
  'map',
  'markdown',
  'number',
  'string',
  'text',
  'uuid',
];

/**
 * List of widgets that support media files.
 * @type {string[]}
 */
export const MEDIA_WIDGETS = ['file', 'image'];

/**
 * List of widgets that support the `multiple` option.
 * @type {string[]}
 */
export const MULTI_VALUE_WIDGETS = [...MEDIA_WIDGETS, 'relation', 'select'];

/**
 * List of widgets that support the `min` and `max` options.
 * @type {string[]}
 */
export const MIN_MAX_VALUE_WIDGETS = [...MULTI_VALUE_WIDGETS, 'list', 'number'];
