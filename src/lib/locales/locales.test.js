import fs from 'node:fs';
import path from 'node:path';

import { MessageFormat } from 'messageformat';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';

/**
 * Locale file used as the source of truth for keys and variables.
 */
const SOURCE_LOCALE = 'en-US';
/**
 * Counts used to exercise every plural category, including the `zero`, `two`, `few` and `many`
 * forms that languages such as Arabic, Polish and Russian rely on.
 */
const SAMPLE_COUNTS = [0, 1, 2, 3, 11, 100];
const localesDir = import.meta.dirname;

/**
 * Read and parse a locale file.
 * @param {string} fileName Locale file name, e.g. `ja.yaml`.
 * @returns {Record<string, any>} Parsed strings.
 */
const readLocale = (fileName) =>
  YAML.parse(fs.readFileSync(path.join(localesDir, fileName), 'utf8'));

/**
 * Flatten a nested string map into dot-notation keys.
 * @param {Record<string, any>} obj Parsed locale strings.
 * @param {string} [prefix] Key prefix used while recursing.
 * @returns {Map<string, string>} Flattened strings, keyed with the full key path.
 */
const flatten = (obj, prefix = '') =>
  new Map(
    Object.entries(obj).flatMap(([key, value]) =>
      value && typeof value === 'object'
        ? [...flatten(value, `${prefix}${key}.`)]
        : [[`${prefix}${key}`, String(value)]],
    ),
  );

/**
 * Get every variable a message refers to, including the `.input` and `.match` declarations that
 * drive plural selection.
 * @param {string} message MessageFormat 2 message.
 * @returns {Set<string>} Variable names without the `$` sigil.
 */
const getDeclaredVariables = (message) =>
  new Set([...message.matchAll(/\$([A-Za-z]+)/g)].map(([, name]) => name));

/**
 * Get the variables a message interpolates into its output, ignoring declarations.
 * @param {string} message MessageFormat 2 message.
 * @returns {Set<string>} Variable names without the `$` sigil.
 */
const getUsedVariables = (message) =>
  new Set([...message.matchAll(/\{\$([A-Za-z]+)\}/g)].map(([, name]) => name));

/**
 * Build arguments for {@link MessageFormat.format}, matching each variable’s declared type.
 * @param {string} message MessageFormat 2 message.
 * @param {number} count Value used for numeric variables.
 * @returns {Record<string, string | number>} Formatting arguments.
 */
const getSampleArgs = (message, count) =>
  Object.fromEntries(
    [...getDeclaredVariables(message)].map((name) => [
      name,
      message.includes(`{$${name} :integer}`) ? count : 'sample',
    ]),
  );

const sourceStrings = flatten(readLocale(`${SOURCE_LOCALE}.yaml`));

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((fileName) => fileName.endsWith('.yaml'))
  .sort();

const translationFiles = localeFiles.filter((fileName) => fileName !== `${SOURCE_LOCALE}.yaml`);

describe('locale files', () => {
  test('the source locale is present and not empty', () => {
    expect(localeFiles).toContain(`${SOURCE_LOCALE}.yaml`);
    expect(sourceStrings.size).toBeGreaterThan(0);
  });

  describe.each(localeFiles)('%s', (fileName) => {
    const locale = fileName.replace(/\.yaml$/, '');
    const strings = flatten(readLocale(fileName));

    test('every message compiles and formats as MessageFormat 2', () => {
      /** @type {string[]} */
      const errors = [];

      strings.forEach((message, key) => {
        SAMPLE_COUNTS.forEach((count) => {
          try {
            new MessageFormat(locale, message).format(getSampleArgs(message, count), (error) => {
              throw error;
            });
          } catch (/** @type {any} */ error) {
            errors.push(`${key} (count: ${count}): ${error.message}`);
          }
        });
      });

      expect(errors).toEqual([]);
    });
  });

  describe.each(translationFiles)('%s', (fileName) => {
    const strings = flatten(readLocale(fileName));

    test(`has no keys that are gone from ${SOURCE_LOCALE}`, () => {
      const staleKeys = [...strings.keys()].filter((key) => !sourceStrings.has(key));

      expect(staleKeys).toEqual([]);
    });

    test('only interpolates variables the source message provides', () => {
      /** @type {string[]} */
      const errors = [];

      strings.forEach((message, key) => {
        const sourceMessage = sourceStrings.get(key);

        if (sourceMessage === undefined) {
          return;
        }

        const available = getDeclaredVariables(sourceMessage);

        // A translation may interpolate a variable the source only selects on — Arabic, for
        // example, spells out the count in plural forms English doesn’t have — but it can never
        // introduce one the source doesn’t provide.
        [...getUsedVariables(message)]
          .filter((name) => !available.has(name))
          .forEach((name) => {
            errors.push(`${key}: $${name}`);
          });
      });

      expect(errors).toEqual([]);
    });
  });
});
