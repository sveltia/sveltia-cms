import { stripTags } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';

/**
 * @import { RichTextField } from '$lib/types/public';
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 */

/**
 * Get the default value map for a RichText/Markdown field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<string, string>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue = get(cmsConfig)?.field_defaults?.richtext?.default } =
    /** @type {RichTextField} */ (fieldConfig);

  let value = '';

  if (dynamicValue !== undefined) {
    try {
      // Sanitize the given value to prevent XSS attacks as the preview may not be sanitized
      value = stripTags(dynamicValue);
    } catch {
      // Fallback for environments where DOMParser is not available (in Vitest). Use a simple regex
      // to remove HTML tags as a basic sanitization measure
      value = dynamicValue.replace(/<[^>]*>/g, '');
    }
  } else {
    value = defaultValue || '';
  }

  return { [keyPath]: value };
};
