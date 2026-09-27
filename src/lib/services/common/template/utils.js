import { FIELD_TAG_PREFIX_REGEX } from '$lib/services/common/template/constants';

/**
 * Remove the `fields.` prefix from a template tag, e.g. `fields.title` becomes `title`. A tag
 * without the prefix is returned as is.
 * @param {string} tag Template tag, without the surrounding braces.
 * @returns {string} Tag without the prefix, which is a field key path.
 */
export const stripFieldTagPrefix = (tag) => tag.replace(FIELD_TAG_PREFIX_REGEX, '');
