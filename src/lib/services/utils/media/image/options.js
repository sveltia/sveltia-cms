/**
 * @import { InternalImageTransformationOptions } from '$lib/types/private';
 */

/**
 * Fill in the defaults of the image transformation options. `width` and `height` have no default,
 * as it depends on the size of the source.
 * @param {InternalImageTransformationOptions} [options] Options.
 * @returns {Required<Omit<InternalImageTransformationOptions, 'width' | 'height'>> &
 * Pick<InternalImageTransformationOptions, 'width' | 'height'>} Options with the defaults.
 */
export const resolveTransformOptions = ({
  format = 'png',
  quality = 85,
  width = undefined,
  height = undefined,
  fit = 'scale-down',
  nativeOnly = false,
} = {}) => ({ format, quality, width, height, fit, nativeOnly });
