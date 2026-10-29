import { lazy } from '$lib/services/utils/cache';

/**
 * Characters that can’t be used in a slug with the default `unicode` encoding: space, control,
 * delimiter, reserved and unwise characters. The zero-width non-joiner (U+200C) and joiner (U+200D)
 * are format characters like the bidi controls, but they are kept: they are part of the spelling of
 * words in Persian and Indic scripts, and join the code points of an emoji sequence, e.g. a family
 * emoji. The pattern uses the `v` flag for the set subtraction, so a global variant has to be
 * created with `gv`, not `gu`. The `&` is written as `\x26`: TypeScript rejects a bare one in a
 * `v`-flag class, and ESLint flags `\&` as a useless escape. It’s created on first use, as the `v`
 * flag would throw while the bundle loads in an unsupported browser; see {@link lazy}.
 * @see https://stackoverflow.com/q/1547899
 */
export const getUnsafeUnicodeSlugCharsRegex = lazy(
  () => /[\p{Z}[\p{C}--[\u200C\u200D]]!"#$%\x26'\(\)*+,\/:;<=>?@\[\\\]^`\{\|\}]/v,
);

/**
 * Characters that can’t be used in a slug with the `ascii` encoding: anything but ASCII letters,
 * digits, underscores, hyphens and tildes.
 */
export const UNSAFE_ASCII_SLUG_CHARS_REGEX = /[^\w-~]/;
