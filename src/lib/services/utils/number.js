const NUMERIC_VALUE_REGEX = /^\d+$/;

/**
 * Check if the given value is a numeric string, consisting of one or more digits only.
 * @param {string} value Value to check.
 * @returns {boolean} True if the value is numeric, false otherwise.
 */
export const isNumeric = (value) => NUMERIC_VALUE_REGEX.test(value);

/**
 * Move the decimal point of the given number without a floating-point error, by changing the
 * exponent of its string representation.
 * @param {number} number Finite number.
 * @param {number} places Number of places to move the decimal point to the right. A negative
 * number moves it to the left.
 * @returns {number} Number multiplied by `10 ** places`.
 */
const shiftDecimalPoint = (number, places) => {
  const [mantissa, exponent = '0'] = String(number).split('e');

  return Number(`${mantissa}e${Number(exponent) + places}`);
};

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

  // Use proper mathematical rounding instead of JavaScript’s native `toFixed`, rounding halves
  // away from zero, so `-1.005` gives `-1.01` like `1.005` gives `1.01`. A fraction is first
  // limited to 15 significant digits, which drops the floating-point error of an arithmetic result
  // like `8.7 * 1.15`, i.e. `10.004999999999999`; an integer is exact, and may have more digits.
  // The decimal point is then moved in the exponent of the string representation rather than by
  // multiplying, which would bring in another error: `1.005 * 100` is `100.49999999999999`
  const value = Math.abs(Number.isInteger(number) ? number : Number(number.toPrecision(15)));
  const rounded = shiftDecimalPoint(Math.round(shiftDecimalPoint(value, decimals)), -decimals);

  // Adding zero turns `-0` into `0`
  return Math.sign(number) * rounded + 0;
};
