#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Check the Sveltia CMS locale files for MessageFormat 2 (MF2) and consistency problems.
 *
 * Translations are contributed by native speakers who can’t easily run the CMS, so mistakes that
 * only show up at render time are hard to catch by review. This script parses every message with
 * the same MF2 implementation the app uses and reports what would go wrong on screen.
 *
 * Three problems fail the check. An MF2 syntax error means the message can’t be parsed at all. A
 * plural variant that can never be selected, because the locale doesn’t have that category, is
 * silently dead: a variant keyed `one` in Japanese never matches, so every count falls through to
 * the catch-all. A placeholder that doesn’t line up with the source locale drops a name or a link
 * from the output, or leaves a raw placeholder on screen.
 *
 * Two more are reported as warnings, because fixing them takes a translator. A key that no longer
 * exists in the source locale is usually left behind by a rename, so the file carries a stale
 * string while the live one falls back to English. A message that doesn’t spell out every plural
 * category its language requires gives some numbers a grammatically wrong form.
 *
 * Usage: node scripts/check-locales.js [--verbose].
 *
 * Options:
 * --verbose  List every warning instead of a per-locale summary.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { isCatchallKey, isSelectMessage, parseMessage } from 'messageformat';
import { parse as parseYAML } from 'yaml';

/**
 * CLDR plural category names. A variant key that isn’t one of these is a literal value, such as
 * `0` or `1`, which is matched before any category and works in every language.
 */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
/**
 * Locale the other files are translated from.
 */
const SOURCE_LOCALE = 'en-US';
/**
 * Variable that translators may reasonably choose to print or omit, depending on how the language
 * reads. Every other placeholder is part of the message structure and has to be kept.
 */
const OPTIONAL_VARIABLE = 'count';
/**
 * Highest number to test when collecting the plural categories a locale uses. This covers every
 * CLDR rule in use, which key off the last one or two digits.
 */
const MAX_SAMPLE = 1000;
const localesDir = join(fileURLToPath(new URL('.', import.meta.url)), '../src/lib/locales');
const isVerbose = process.argv.includes('--verbose');

/**
 * Flatten a parsed locale file into a map of dot-delimited key to message.
 * @param {Record<string, any>} object Parsed YAML object.
 * @param {string} [prefix] Key prefix used while recursing.
 * @returns {Record<string, string>} Messages keyed by their full path.
 */
const flattenMessages = (object, prefix = '') =>
  Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        return [[path, value]];
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(flattenMessages(value, path));
      }

      return [];
    }),
  );

/**
 * Get the plural categories a locale actually uses.
 * @param {string} locale Locale code.
 * @returns {Set<string>} Category names, always including `other`.
 */
const getPluralCategories = (locale) => {
  const rules = new Intl.PluralRules(locale);
  /** @type {Set<string>} */
  const categories = new Set();

  for (let number = 0; number <= MAX_SAMPLE; number += 1) {
    categories.add(rules.select(number));
  }

  return categories;
};

/**
 * Get the variables a message puts on screen. A `.input` declaration doesn’t render anything, and
 * a message may well select on a value it never prints, so only the patterns are considered.
 * @param {string} message MF2 message source.
 * @returns {Set<string>} Variable names.
 */
const getRenderedVariables = (message) => {
  const patterns = message.includes('.match')
    ? [...message.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(([, body]) => body).join(' ')
    : message;

  return new Set([...patterns.matchAll(/\{\$([a-zA-Z0-9_]+)/g)].map(([, name]) => name));
};

/**
 * Get the variant keys a message selects on, ignoring the `*` catch-all.
 * @param {any} message Parsed MF2 message.
 * @returns {Set<string>} Variant keys.
 */
const getVariantKeys = (message) =>
  new Set(
    message.variants.flatMap(({ keys }) =>
      keys.filter((key) => !isCatchallKey(key)).map(({ value }) => value),
    ),
  );

/**
 * Check every locale file and report what’s wrong.
 * @returns {number} Process exit code.
 */
const main = () => {
  const locales = readdirSync(localesDir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => name.replace(/\.yaml$/, ''));

  const messages = Object.fromEntries(
    locales.map((locale) => [
      locale,
      flattenMessages(parseYAML(readFileSync(join(localesDir, `${locale}.yaml`), 'utf-8'))),
    ]),
  );

  /** @type {{ locale: string, key: string, detail: string }[]} */
  const errors = [];
  /** @type {{ locale: string, key: string, detail: string }[]} */
  const warnings = [];

  locales.forEach((locale) => {
    const categories = getPluralCategories(locale);

    Object.entries(messages[locale]).forEach(([key, message]) => {
      const source = messages[SOURCE_LOCALE][key];

      if (source === undefined) {
        warnings.push({ locale, key, detail: `no longer in ${SOURCE_LOCALE}` });
      } else if (locale !== SOURCE_LOCALE) {
        const expected = getRenderedVariables(source);
        const actual = getRenderedVariables(message);

        const missing = [...expected].filter(
          (name) => name !== OPTIONAL_VARIABLE && !actual.has(name),
        );

        const extra = [...actual].filter(
          (name) => name !== OPTIONAL_VARIABLE && !expected.has(name),
        );

        if (missing.length) {
          errors.push({ locale, key, detail: `missing placeholder ${missing.join(', ')}` });
        }

        if (extra.length) {
          errors.push({ locale, key, detail: `unknown placeholder ${extra.join(', ')}` });
        }
      }

      /** @type {any} */
      let parsed;

      try {
        parsed = parseMessage(message);
      } catch (/** @type {any} */ ex) {
        errors.push({ locale, key, detail: `MF2 syntax error: ${ex.message}` });

        return;
      }

      if (!isSelectMessage(parsed)) {
        return;
      }

      const variantKeys = getVariantKeys(parsed);

      variantKeys.forEach((variantKey) => {
        if (PLURAL_CATEGORIES.includes(variantKey) && !categories.has(variantKey)) {
          errors.push({
            locale,
            key,
            detail:
              `\`${variantKey}\` is not a plural category in ${locale}, so the variant is ` +
              'never selected; use the literal value instead, e.g. `1`',
          });
        }
      });

      const unhandled = [...categories].filter(
        (category) => category !== 'other' && !variantKeys.has(category),
      );

      // A message that spells out no category at all uses one form on purpose, which is fine
      if (variantKeys.size && unhandled.length) {
        warnings.push({ locale, key, detail: `no variant for ${unhandled.join(', ')}` });
      }
    });
  });

  /**
   * Print a group of findings, one line per locale unless `--verbose` is set.
   * @param {string} label Group heading.
   * @param {{ locale: string, key: string, detail: string }[]} findings Findings to print.
   * @param {boolean} listAll Whether to list every finding.
   */
  const report = (label, findings, listAll) => {
    if (!findings.length) {
      return;
    }

    console.log(`\n${label} (${findings.length}):`);

    locales.forEach((locale) => {
      const own = findings.filter((finding) => finding.locale === locale);

      if (!own.length) {
        return;
      }

      if (listAll) {
        own.forEach(({ key, detail }) => console.log(`  ${locale}  ${key} — ${detail}`));
      } else {
        const [{ key, detail }] = own;
        const rest = own.length > 1 ? ` (+${own.length - 1} more)` : '';

        console.log(`  ${locale}  ${key} — ${detail}${rest}`);
      }
    });
  };

  report('Errors', errors, true);
  report('Warnings', warnings, isVerbose);

  console.log(
    `\nChecked ${locales.length} locales: ${errors.length} errors, ${warnings.length} warnings.`,
  );

  if (warnings.length && !isVerbose) {
    console.log('Run with --verbose to list every warning.');
  }

  return errors.length ? 1 : 0;
};

process.exit(main());
