import { fromJS } from 'immutable';

/**
 * @import { MapOf } from 'immutable';
 * @import { CustomField } from '$lib/types/public';
 */

/**
 * Cache of Immutable Maps converted from field configurations. Field configurations are immutable
 * objects created once during config normalization, so they can be safely used as `WeakMap` keys,
 * and entries are garbage collected along with the configuration.
 * @type {WeakMap<CustomField, MapOf<CustomField>>}
 */
const fieldConfigMapCache = new WeakMap();

/**
 * Convert a field configuration to an Immutable Map for a React component, reusing the previous
 * result for the same configuration object. Returning a stable reference avoids deep-converting the
 * configuration on every render and lets `React.memo()` and `shouldComponentUpdate()` in custom
 * widgets skip unnecessary re-renders.
 * @param {CustomField} fieldConfig Field configuration.
 * @returns {MapOf<CustomField>} Immutable Map of the field configuration.
 */
export const getFieldConfigMap = (fieldConfig) => {
  const cached = fieldConfigMapCache.get(fieldConfig);

  if (cached) {
    return cached;
  }

  const map = /** @type {MapOf<CustomField>} */ (fromJS(fieldConfig));

  fieldConfigMapCache.set(fieldConfig, map);

  return map;
};
