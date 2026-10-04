import equal from 'fast-deep-equal';
import { flatten, unflatten } from 'flat';

import { normalizeContent } from '$lib/services/contents/draft/create/normalize';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
import { unflattenMap } from '$lib/services/utils/object';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field, RawEntryContent } from '$lib/types/public';
 */

/**
 * Remove the values of a rich text editor component from the given flattened value map, e.g. the
 * `extraValues` or the validities of a locale in an entry draft. The map is modified in place.
 * @param {Record<string, any> | undefined} valueMap Flattened value map.
 * @param {string} keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 */
export const deleteKeysByPrefix = (valueMap, keyPathPrefix) => {
  Object.keys(valueMap ?? {}).forEach((key) => {
    if (key.startsWith(keyPathPrefix)) {
      delete (/** @type {Record<string, any>} */ (valueMap)[key]);
    }
  });
};

/**
 * Flatten the values of a rich text editor component, and prefix the keys with the component’s key
 * path prefix, so they can be stored in the `extraValues` of an entry draft.
 * @param {Record<string, any>} values Component values.
 * @param {string} keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 * @returns {Record<string, any>} Flattened value map.
 */
export const flattenWithPrefix = (values, keyPathPrefix) =>
  Object.fromEntries(
    Object.entries(flatten(values)).map(([key, value]) => [`${keyPathPrefix}${key}`, value]),
  );

/**
 * Get the values of a rich text editor component from the given flattened value map, e.g. the
 * `extraValues` of a locale in an entry draft, without the component’s key path prefix.
 * @param {Record<string, any>} valueMap Flattened value map.
 * @param {string} keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 * @returns {RawEntryContent} Component values (unflattened).
 */
export const getValuesByPrefix = (valueMap, keyPathPrefix) =>
  unflattenMap(
    Object.fromEntries(
      getKeysByPrefix(valueMap, keyPathPrefix).map((key) => [
        key.slice(keyPathPrefix.length),
        valueMap[key],
      ]),
    ),
  );

/**
 * Reconcile the values of a rich text editor component, as parsed from the document, with the
 * component’s field definitions, which may have changed since the document was written. A freshly
 * inserted component without values gets the default values. Unlike an entry draft, missing values
 * are not filled in, because these values live in the document text and doing so would rewrite it
 * just by opening the entry.
 * @param {object} args Arguments.
 * @param {Record<string, any> | undefined} args.values Component values. The component name is
 * added to them in place.
 * @param {Field[]} args.fields Field definitions of the component.
 * @param {string} args.componentName Component name.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code.
 * @returns {Record<string, any>} Reconciled values: the given values themselves if nothing has
 * changed, or a new object otherwise, so a caller can tell whether to reassign them.
 */
export const reconcileComponentValues = ({
  values,
  fields,
  componentName,
  locale,
  defaultLocale,
}) => {
  const _values = /** @type {Record<string, any>} */ (
    values ?? unflatten(getDefaultValues({ fields, locale, defaultLocale }))
  );

  _values.__sc_component_name = componentName;

  /** @type {Record<string, any>} */
  const normalizedValues = unflatten(
    normalizeContent({
      fields,
      content: flatten(_values),
      locale,
      defaultLocale,
      fillDefaults: false,
    }),
  );

  // `normalizeContent()` is idempotent, but a fresh object every time would make a caller that
  // reassigns the values react to them forever
  return equal(normalizedValues, _values) ? _values : normalizedValues;
};
