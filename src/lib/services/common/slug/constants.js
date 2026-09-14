/**
 * Characters that can’t be used in a slug with the default `unicode` encoding: space, control,
 * delimiter, reserved and unwise characters.
 * @see https://stackoverflow.com/q/1547899
 */
export const UNSAFE_UNICODE_SLUG_CHARS_REGEX = /[\p{Z}\p{C}!"#$%&'()*+,/:;<=>?@[\\\]^`{|}]/u;

/**
 * Characters that can’t be used in a slug with the `ascii` encoding: anything but ASCII letters,
 * digits, underscores, hyphens and tildes.
 */
export const UNSAFE_ASCII_SLUG_CHARS_REGEX = /[^\w-~]/;
