#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Check the Sveltia CMS locale files against the file and formatting rules in
 * `src/lib/locales/README.md` that nothing else verifies. `check-locales.js` covers the
 * MessageFormat 2 rules, and Prettier the YAML syntax, LF line endings, trailing newline and single
 * quotes. This script covers the rest:
 *
 * - The file name is a short (`sk`) or full (`pt-BR`) language code.
 * - The file is valid UTF-8 without a byte order mark.
 * - Every comment of the source locale is kept, unchanged and in the same order.
 * - Values are quoted only when YAML requires it.
 * - Prose uses typographic quotes and apostrophes, keeping straight ones for code and markup.
 * - Code spans, HTML tags and Markdown link targets match the source string.
 * - Every source key is translated, and no other key exists.
 *
 * Usage: node scripts/check-locale-style.js [--verbose] [--dir=<path>] [locale…].
 *
 * Without a locale, every translated locale is checked and findings are summarized per rule.
 *
 * Options:
 * --verbose     List every finding instead of a per-locale summary.
 * --dir=<path>  Check another locale directory with the same layout, e.g. the Sveltia UI one.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { isMap, isScalar, parseDocument, Scalar, stringify, visit } from 'yaml';

/**
 * @import { Pair } from 'yaml';
 */

const SOURCE_LOCALE = 'en-US';
const LOCALE_CODE = /^[a-z]{2,3}(-[A-Z]{2}|-[A-Z][a-z]{3})?$/;
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');
const dirArg = args.find((arg) => arg.startsWith('--dir='))?.slice('--dir='.length);
const requestedLocales = args.filter((arg) => !arg.startsWith('--'));

const localesDir = dirArg
  ? resolve(dirArg)
  : join(fileURLToPath(new URL('.', import.meta.url)), '../src/lib/locales');

/**
 * @typedef {object} LocaleFile
 * @property {string} raw File contents.
 * @property {Map<string, Scalar>} scalars Value scalars keyed by dot-delimited
 * path.
 */

/**
 * Read and parse a locale file.
 * @param {string} locale Locale code.
 * @returns {LocaleFile} Parsed file.
 */
const readLocale = (locale) => {
  const raw = readFileSync(join(localesDir, `${locale}.yaml`), 'utf-8');
  const doc = parseDocument(raw);
  /** @type {Map<string, Scalar>} */
  const scalars = new Map();

  visit(doc, {
    /**
     * Collect a string value with its dot-delimited path.
     * @param {unknown} _key Index of the pair in its map.
     * @param {Pair<any, any>} pair Key-value pair.
     * @param {readonly any[]} path Ancestors of the pair.
     */
    Pair(_key, pair, path) {
      if (isScalar(pair.value) && typeof pair.value.value === 'string') {
        const keys = [...path, pair]
          .filter((node) => !isMap(node) && /** @type {any} */ (node).key)
          .map((node) => String(/** @type {any} */ (node).key.value));

        scalars.set(keys.join('.'), pair.value);
      }
    },
  });

  return { raw, scalars };
};

/**
 * Get the comment lines of a file, trimmed, in order.
 * @param {string} raw File contents.
 * @returns {string[]} Comment lines.
 */
const getComments = (raw) =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'));

/**
 * Remove the parts of a message where straight quotes are code rather than prose: code spans, HTML
 * tags, MF2 expressions and declarations, and the `{{ }}` delimiters of MF2 variants.
 * @param {string} message Message.
 * @returns {string} Prose only.
 */
const getProse = (message) =>
  message
    .replace(/`[^`]*`/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s*\.(input|local|match)\b.*$/gm, '')
    .replace(/\{\{|\}\}/g, '')
    .replace(/\{[^{}]*\}/g, '');

/**
 * Get the formatting tokens a translation has to keep from the source, deduplicated and sorted,
 * since MF2 variants each repeat them.
 * @param {string} message Message.
 * @returns {Record<string, string[]>} Code spans, HTML tags and Markdown link targets.
 */
const getFormatting = (message) => {
  /**
   * Get the unique matches of a pattern, sorted.
   * @param {RegExp} pattern Global pattern; its first group, if any, is the token.
   * @returns {string[]} Tokens.
   */
  const tokens = (pattern) =>
    [...new Set([...message.matchAll(pattern)].map(([match, group]) => group ?? match))].sort();

  return {
    'code span': tokens(/`[^`]*`/g),
    'HTML tag': tokens(/<\/?[a-z][a-z0-9]*[^>]*>/gi),
    'link target': tokens(/\]\(([^)]*)\)/g),
  };
};

/**
 * Check one locale against the source.
 * @param {string} locale Locale code.
 * @param {LocaleFile} source Source locale file.
 * @returns {{ rule: string, detail: string }[]} Findings.
 */
const checkLocale = (locale, source) => {
  /** @type {{ rule: string, detail: string }[]} */
  const findings = [];
  const bytes = readFileSync(join(localesDir, `${locale}.yaml`));
  const { raw, scalars } = readLocale(locale);

  if (!LOCALE_CODE.test(locale)) {
    findings.push({ rule: 'file name', detail: `${locale} is not a language code` });
  }

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    findings.push({ rule: 'encoding', detail: 'starts with a byte order mark' });
  }

  if (!bytes.equals(Buffer.from(raw, 'utf-8'))) {
    findings.push({ rule: 'encoding', detail: 'not valid UTF-8' });
  }

  const sourceComments = getComments(source.raw);
  const comments = getComments(raw);
  const firstDiff = sourceComments.findIndex((line, index) => comments[index] !== line);

  if (firstDiff !== -1 || comments.length !== sourceComments.length) {
    const index = firstDiff === -1 ? sourceComments.length : firstDiff;

    findings.push({
      rule: 'comments',
      detail:
        `comment ${index + 1} differs from ${SOURCE_LOCALE}: ` +
        `expected ${JSON.stringify(sourceComments[index] ?? '(none)')}, ` +
        `found ${JSON.stringify(comments[index] ?? '(none)')}`,
    });
  }

  scalars.forEach((scalar, key) => {
    const sourceScalar = source.scalars.get(key);
    const { value } = /** @type {{ value: string }} */ (scalar);

    if (!sourceScalar) {
      findings.push({ rule: 'keys', detail: `${key} is not in ${SOURCE_LOCALE}` });
    }

    if (
      [Scalar.QUOTE_SINGLE, Scalar.QUOTE_DOUBLE].includes(/** @type {any} */ (scalar.type)) &&
      !/^['"]/.test(stringify(value))
    ) {
      findings.push({ rule: 'quotes', detail: `${key} is quoted but doesn’t need to be` });
    }

    if (locale === SOURCE_LOCALE || !sourceScalar) {
      return;
    }

    const prose = getProse(value);

    if (/["']/.test(prose) && !/["']/.test(getProse(/** @type {string} */ (sourceScalar.value)))) {
      findings.push({
        rule: 'typographic quotes',
        detail: `${key} has a straight quote or apostrophe in prose`,
      });
    }

    const expected = getFormatting(/** @type {string} */ (sourceScalar.value));
    const actual = getFormatting(value);

    Object.entries(expected).forEach(([kind, tokens]) => {
      if (tokens.join('\n') !== actual[kind].join('\n')) {
        findings.push({
          rule: 'formatting',
          detail: `${key} ${kind}s differ: expected ${tokens.join(' ') || '(none)'}, found ${
            actual[kind].join(' ') || '(none)'
          }`,
        });
      }
    });
  });

  if (locale !== SOURCE_LOCALE) {
    const missing = [...source.scalars.keys()].filter((key) => !scalars.has(key));

    if (missing.length) {
      findings.push({
        rule: 'keys',
        detail: `${missing.length} untranslated keys, e.g. ${missing.slice(0, 3).join(', ')}`,
      });
    }

    if (isVerbose) {
      missing.forEach((key) => findings.push({ rule: 'keys', detail: `${key} is missing` }));
    }
  }

  return findings;
};

/**
 * Check the requested locales and print the findings.
 * @returns {number} Process exit code.
 */
const main = () => {
  const source = readLocale(SOURCE_LOCALE);

  const locales = requestedLocales.length
    ? requestedLocales
    : readdirSync(localesDir)
        .filter((name) => name.endsWith('.yaml'))
        .map((name) => name.replace(/\.yaml$/, ''));

  let total = 0;

  locales.forEach((locale) => {
    const findings = checkLocale(locale, source);

    total += findings.length;

    if (!findings.length) {
      return;
    }

    if (isVerbose || requestedLocales.length) {
      findings.forEach(({ rule, detail }) => console.log(`${locale}  [${rule}] ${detail}`));
    } else {
      const rules = [...new Set(findings.map(({ rule }) => rule))].map(
        (rule) => `${rule} ×${findings.filter((finding) => finding.rule === rule).length}`,
      );

      console.log(`${locale}  ${rules.join(', ')}`);
    }
  });

  console.log(`\nChecked ${locales.length} locales: ${total} findings.`);

  return total ? 1 : 0;
};

process.exit(main());
