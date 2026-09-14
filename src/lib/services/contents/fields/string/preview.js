import { isURL } from '@sveltia/utils/string';

import { isYouTubeVideoURL } from '$lib/services/utils/media/video/youtube';

/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * How a String field value is shown in the preview.
 * @typedef {'youtube' | 'link' | 'email' | 'text'} StringPreviewType
 */

/**
 * Protocols a value is linked with. Anything else, e.g. `javascript:` or plain `http:`, is shown as
 * text.
 */
const SAFE_PROTOCOL_REGEX = /^(?:https|mailto|tel):/;

/**
 * Determine how a String field value is shown in the preview: a YouTube video is embedded, a URL
 * with a safe protocol is linked, an email address is linked with `mailto:`, and anything else is
 * shown as text.
 * @param {object} args Arguments.
 * @param {StringField} args.fieldConfig Field configuration.
 * @param {string} args.value Field value.
 * @returns {StringPreviewType} Preview type.
 */
export const getPreviewType = ({ fieldConfig, value }) => {
  const { type = 'text' } = fieldConfig;

  if (type === 'url' || isURL(value)) {
    if (isYouTubeVideoURL(value)) {
      return 'youtube';
    }

    return SAFE_PROTOCOL_REGEX.test(value) ? 'link' : 'text';
  }

  return type === 'email' ? 'email' : 'text';
};
