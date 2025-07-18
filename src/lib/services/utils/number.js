/**
 * Convert a number to a fixed decimal string.
 * @param {number} number Number to convert.
 * @param {number} decimals Number of decimal places to keep.
 * @returns {number} Number with fixed decimal places.
 */
export const toFixed = (number, decimals) => {
  // Handle non-numeric inputs
  if (typeof number !== 'number') {
    return NaN;
  }

  // Handle special cases
  if (!Number.isFinite(number)) {
    // Returns NaN or Infinity as-is
    return number;
  }

  // Use proper mathematical rounding instead of JavaScript’s native `toFixed`
  const factor = 10 ** decimals;

  return Math.round(number * factor) / factor;
};
