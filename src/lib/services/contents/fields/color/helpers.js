/**
 * Regular expression matching a hex color, with an optional alpha channel.
 */
const HEX_COLOR_REGEX = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})(?<a>[0-9a-f]{2})?$/i;
/**
 * Parse a two-digit hex value as an integer.
 * @param {string} hex Hex value.
 * @returns {number} Integer.
 */
const hexToInt = (hex) => Number.parseInt(hex, 16);

/**
 * Format a hex color as a CSS `rgb()` string, e.g. `#ff8000` as `rgb(255 128 0)`, so the channel
 * values can be shown next to the hex value.
 * @param {string | undefined} hex Hex color.
 * @param {object} [options] Options.
 * @param {boolean} [options.enableAlpha] Whether to include the alpha channel, as a percentage, if
 * the color has one.
 * @returns {string} Formatted color, or an empty string if the value is not a hex color.
 */
export const formatHexAsRGB = (hex, { enableAlpha = false } = {}) => {
  const { r, g, b, a } = hex?.match(HEX_COLOR_REGEX)?.groups ?? {};

  if (!r) {
    return '';
  }

  const alpha = enableAlpha && a ? ` / ${Math.round((hexToInt(a) / 255) * 100)}%` : '';

  return `rgb(${hexToInt(r)} ${hexToInt(g)} ${hexToInt(b)}${alpha})`;
};

/**
 * Regular expression matching a 6-digit hex color, which is what a color input accepts.
 */
const RGB_HEX_REGEX = /^#[0-9a-f]{6}$/i;

/**
 * Split a stored color into the parts the editor’s controls take: the 6-digit hex color for the
 * color input, and the alpha channel as an integer for the opacity slider.
 * @param {any} currentValue Value in the entry draft.
 * @returns {{ rgb: string, alpha: number } | undefined} Parts, or `undefined` if the value is not a
 * hex color, in which case the controls keep what they have.
 */
export const parseColorFieldValue = (currentValue) => {
  if (typeof currentValue !== 'string') {
    return undefined;
  }

  const { r, g, b, a = 'ff' } = currentValue.match(HEX_COLOR_REGEX)?.groups ?? {};

  if (!r) {
    return undefined;
  }

  return { rgb: `#${r}${g}${b}`, alpha: hexToInt(a) };
};

/**
 * Get the value to be stored in the entry draft for the editor’s controls.
 * @param {object} args Arguments.
 * @param {string} args.rgb Value of the color input.
 * @param {number} args.alpha Value of the opacity slider, from 0 to 255.
 * @param {boolean} [args.enableAlpha] Whether the field stores the alpha channel.
 * @returns {string} Hex color, with the alpha channel if enabled, or an empty string if the color
 * input holds nothing usable.
 */
export const getColorFieldValue = ({ rgb, alpha, enableAlpha = false }) => {
  if (!RGB_HEX_REGEX.test(rgb)) {
    return '';
  }

  return enableAlpha ? `${rgb}${alpha.toString(16).padStart(2, '0')}` : rgb;
};
