import { getDefaultValueMap as getBooleanFieldDefaultValueMap } from '$lib/services/contents/fields/boolean/defaults';
import { getDefaultValueMap as getCodeFieldDefaultValueMap } from '$lib/services/contents/fields/code/defaults';
import { getDefaultValueMap as getDateTimeFieldDefaultValueMap } from '$lib/services/contents/fields/date-time/defaults';
import { getDefaultValueMap as getFileFieldDefaultValueMap } from '$lib/services/contents/fields/file/defaults';
import { getDefaultValueMap as getHiddenFieldDefaultValueMap } from '$lib/services/contents/fields/hidden/defaults';
import { getDefaultValueMap as getKeyValueFieldDefaultValueMap } from '$lib/services/contents/fields/key-value/defaults';
import { getDefaultValueMap as getListFieldDefaultValueMap } from '$lib/services/contents/fields/list/defaults';
import { getDefaultValueMap as getNumberFieldDefaultValueMap } from '$lib/services/contents/fields/number/defaults';
import { getDefaultValueMap as getObjectFieldDefaultValueMap } from '$lib/services/contents/fields/object/defaults';
import { getDefaultValueMap as getRichTextFieldDefaultValueMap } from '$lib/services/contents/fields/rich-text/defaults';
import { getDefaultValueMap as getSelectFieldDefaultValueMap } from '$lib/services/contents/fields/select/defaults';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Map of functions to get default values for different field types.
 * @type {Record<string, (args: GetDefaultValueMapFuncArgs) => Record<FieldKeyPath, any>>}
 */
export const GET_DEFAULT_VALUE_MAP_FUNCTIONS = {
  boolean: getBooleanFieldDefaultValueMap,
  code: getCodeFieldDefaultValueMap,
  datetime: getDateTimeFieldDefaultValueMap,
  file: getFileFieldDefaultValueMap,
  hidden: getHiddenFieldDefaultValueMap,
  image: getFileFieldDefaultValueMap, // alias
  keyvalue: getKeyValueFieldDefaultValueMap,
  list: getListFieldDefaultValueMap,
  markdown: getRichTextFieldDefaultValueMap, // alias
  number: getNumberFieldDefaultValueMap,
  object: getObjectFieldDefaultValueMap,
  relation: getSelectFieldDefaultValueMap, // alias
  richtext: getRichTextFieldDefaultValueMap,
  select: getSelectFieldDefaultValueMap,
};
