#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Sync the strings added to or changed in the source locale (`en-US`) to the other locale files.
 *
 * The translation itself is done by people or agents; this script prepares the work and puts the
 * result back. It has two commands.
 *
 * `todo` lists, for each locale, the keys the locale lacks and the keys whose English changed since
 * the locale’s translation was last updated. A changed string is found by walking the history of
 * the locale file since the last sync: for every key, it remembers the English at the time the
 * translation was last touched, and flags the key when that English differs from the current one.
 * A locale added after the last sync starts from the commit that added it. Each locale gets a
 * `<locale>.todo.json` file listing the keys in file order, with the translator comments above each
 * key as context, and the output folder gets `BRIEF.md`, the instructions for the translators,
 * filled in from `sync-locales.md` next to this script.
 *
 * `apply` rebuilds a locale file from the structure of `en-US.yaml`, so its keys are in the same
 * order under the same comments, filling each key with the translation from the given JSON files
 * (later files win) or else the locale’s current one. A key with no translation is left out, so it
 * falls back to English. A locale’s own header comment, such as notes on its conventions, is kept.
 *
 * Usage:
 * node scripts/sync-locales.js todo [--since <commit>] [--out <dir>] [<locale>…]
 * node scripts/sync-locales.js apply <locale> [<translations.json>…].
 *
 * Options:
 * --since  Commit of the last sync. Defaults to the latest commit whose message starts with
 * “Sync and translate”.
 * --out    Folder to write the todo files and the brief to. Defaults to `sveltia-cms-l10n` in the
 * system’s temporary folder.
 */

import { execFileSync } from 'child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { isMap, isPair, isScalar, parseDocument, parse as parseYAML, Scalar, visit } from 'yaml';

/**
 * @typedef {import('yaml').Pair<Scalar, Scalar>} MessagePair A key-value pair in a locale file.
 */

/**
 * Locale the other files are translated from.
 */
const SOURCE_LOCALE = 'en-US';
/**
 * Pattern of the commit message the default `--since` commit is found by.
 */
const SYNC_COMMIT_PATTERN = '^Sync and translate';
const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(scriptsDir, '..');
const localesPath = 'src/lib/locales';
const localesDir = join(rootDir, localesPath);

/**
 * Run a Git command in the repository root.
 * @param {string[]} args Command arguments.
 * @returns {string} Standard output.
 */
const git = (...args) =>
  execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 ** 3,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/**
 * Flatten a parsed locale file into a map of dot-delimited key to message.
 * @param {Record<string, any>} object Parsed YAML object.
 * @param {string} [prefix] Key prefix used while recursing.
 * @returns {Record<string, string>} Messages keyed by their full path.
 */
const flattenMessages = (object, prefix = '') =>
  Object.fromEntries(
    Object.entries(object ?? {}).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object') {
        return Object.entries(flattenMessages(value, path));
      }

      return [[path, String(value)]];
    }),
  );

/**
 * Read a locale file at a commit.
 * @param {string} commit Commit hash or ref.
 * @param {string} locale Locale code.
 * @returns {Record<string, string> | null} Flattened messages, or `null` if the file didn’t exist.
 */
const readLocaleAt = (commit, locale) => {
  let source;

  try {
    source = git('show', `${commit}:${localesPath}/${locale}.yaml`);
  } catch {
    return null;
  }

  return flattenMessages(parseYAML(source));
};

/**
 * Read a locale file in the working tree.
 * @param {string} locale Locale code.
 * @returns {string | null} File content, or `null` if the file doesn’t exist.
 */
const readLocaleFile = (locale) => {
  try {
    return readFileSync(join(localesDir, `${locale}.yaml`), 'utf8');
  } catch {
    return null;
  }
};

/**
 * Cache of the source locale’s messages by commit.
 * @type {Map<string, Record<string, string>>}
 */
const sourceCache = new Map();

/**
 * Read the source locale at a commit, caching the result.
 * @param {string} commit Commit hash or ref.
 * @returns {Record<string, string>} Flattened messages.
 */
const readSourceAt = (commit) => {
  if (!sourceCache.has(commit)) {
    sourceCache.set(commit, readLocaleAt(commit, SOURCE_LOCALE) ?? {});
  }

  return /** @type {Record<string, string>} */ (sourceCache.get(commit));
};

/**
 * Get the dot-delimited key of a pair.
 * @param {import('yaml').Pair} pair YAML pair.
 * @param {readonly unknown[]} path Ancestors of the pair, as passed by `visit`.
 * @returns {string} Key.
 */
const getKey = (pair, path) =>
  [...path.filter(isPair), pair].map((p) => /** @type {Scalar} */ (p.key).value).join('.');

/**
 * Walk a parsed YAML document and call back for every key with a scalar value.
 * @param {import('yaml').Document} doc Parsed document.
 * @param {(key: string, pair: MessagePair, parents: MessagePair[]) => symbol | void} callback
 * Called with the dot-delimited key, the pair and its parent pairs.
 */
const visitMessages = (doc, callback) => {
  visit(doc, {
    /**
     * Visit a key-value pair.
     * @param {unknown} _ Key of the pair in its parent, unused.
     * @param {import('yaml').Pair} pair Pair.
     * @param {readonly unknown[]} path Ancestors of the pair.
     */
    Pair: (_, pair, path) => {
      if (isScalar(pair.value)) {
        const parents = /** @type {MessagePair[]} */ (path.filter(isPair));

        callback(getKey(pair, path), /** @type {MessagePair} */ (pair), parents);
      }
    },
  });
};

/**
 * Read the source locale in the working tree, which may have strings not committed yet.
 * @returns {Record<string, string>} Flattened messages.
 */
const readSource = () => flattenMessages(parseYAML(readLocaleFile(SOURCE_LOCALE) ?? ''));

/**
 * Read the source locale file as a YAML document.
 * @returns {import('yaml').Document} Parsed document, comments included.
 */
const readSourceDocument = () =>
  parseDocument(readFileSync(join(localesDir, `${SOURCE_LOCALE}.yaml`), 'utf8'));

/**
 * Get the translator comment above a pair, on one line.
 * @param {MessagePair} pair YAML pair.
 * @returns {string} Comment text, without section rules.
 */
const getComment = (pair) =>
  (pair.key.commentBefore ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^=+$/.test(line))
    .join(' ');

/**
 * List the locales other than the source locale.
 * @returns {string[]} Locale codes.
 */
const listLocales = () =>
  readdirSync(localesDir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => name.replace(/\.yaml$/, ''))
    .filter((locale) => locale !== SOURCE_LOCALE)
    .sort();

/**
 * Find the strings a locale lacks or has an outdated translation of.
 * @param {string} locale Locale code.
 * @param {string} since Commit of the last sync.
 * @param {Record<string, string>} source Current source messages.
 * @returns {{ base: string | null, missing: string[], changed: Record<string, { previous: string |
 * null, current: string }> }} Missing keys and changed keys with the English the translation was
 * based on and the translation itself.
 */
const findOutdated = (locale, since, source) => {
  /** @type {string | null} */
  let base = since;
  let messages = readLocaleAt(base, locale);

  if (!messages) {
    // The locale was added after the last sync, or isn’t committed yet
    [base] = git(
      'log',
      '--no-renames',
      '--diff-filter=A',
      '--format=%H',
      '--',
      `${localesPath}/${locale}.yaml`,
    )
      .trim()
      .split('\n');
    base ||= null;
    messages = (base && readLocaleAt(base, locale)) ?? {};
  }

  const baseSource = base ? readSourceAt(base) : {};
  /** @type {Record<string, string | undefined>} */
  const basedOn = Object.fromEntries(Object.keys(messages).map((key) => [key, baseSource[key]]));

  const commits = base
    ? git('log', '--reverse', '--format=%H', `${base}..HEAD`, '--', `${localesPath}/${locale}.yaml`)
    : '';

  commits
    .trim()
    .split('\n')
    .filter(Boolean)
    .forEach((commit) => {
      const updated = readLocaleAt(commit, locale) ?? {};
      const commitSource = readSourceAt(commit);

      Object.entries(updated).forEach(([key, value]) => {
        if (messages?.[key] !== value) {
          basedOn[key] = commitSource[key];
        }
      });

      messages = updated;
    });

  const current = flattenMessages(parseYAML(readLocaleFile(locale) ?? ''));

  // A translation changed in the working tree but not committed yet, e.g. by a sync in progress, is
  // up to date
  Object.entries(current).forEach(([key, value]) => {
    if (messages?.[key] !== value) {
      basedOn[key] = source[key];
    }
  });

  const missing = Object.keys(source).filter((key) => !(key in current));

  const changed = Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => key in current && basedOn[key] !== value)
      .map(([key]) => [key, { previous: basedOn[key] ?? null, current: current[key] }]),
  );

  return { base, missing, changed };
};

/**
 * Get the value of a command line option.
 * @param {string[]} args Command line arguments; the option and its value are removed.
 * @param {string} name Option name, e.g. `--out`.
 * @returns {string | undefined} Option value.
 * @throws {Error} If the option has no value.
 */
const takeOption = (args, name) => {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const [, value] = args.splice(index, 2);

  if (!value || value.startsWith('--')) {
    throw new Error(`The ${name} option needs a value.`);
  }

  return value;
};

/**
 * Run the `todo` command.
 * @param {string[]} args Command line arguments.
 * @returns {number} Exit code.
 */
const todo = (args) => {
  const outDir = resolve(takeOption(args, '--out') ?? join(tmpdir(), 'sveltia-cms-l10n'));

  const since =
    takeOption(args, '--since') ??
    git('log', '-1', '--format=%H', `--grep=${SYNC_COMMIT_PATTERN}`, '--', localesPath).trim();

  if (!since) {
    console.error('No sync commit found. Pass the commit of the last sync with --since.');

    return 1;
  }

  let sinceHash = '';

  try {
    sinceHash = git('rev-parse', '--verify', '--quiet', `${since}^{commit}`).trim();
  } catch {
    console.error(`Unknown commit: ${since}`);

    return 1;
  }

  const unknownOption = args.find((arg) => arg.startsWith('--'));
  const unknownLocale = args.find((arg) => readLocaleFile(arg) === null);

  if (unknownOption || unknownLocale) {
    console.error(
      unknownOption ? `Unknown option: ${unknownOption}` : `Unknown locale: ${unknownLocale}`,
    );

    return 1;
  }

  if (args.includes(SOURCE_LOCALE)) {
    console.error(`${SOURCE_LOCALE} is the source locale, which the others are synced to.`);

    return 1;
  }

  const locales = args.length ? args : listLocales();
  const source = readSource();
  /** @type {Record<string, string>} */
  const comments = {};

  visitMessages(readSourceDocument(), (key, pair, parents) => {
    comments[key] = [...parents.map((p) => getComment(p)), getComment(pair)]
      .filter(Boolean)
      .join(' | ');
  });

  mkdirSync(join(outDir, 'todo'), { recursive: true });
  console.log(`Changes since ${sinceHash.slice(0, 9)}, written to ${outDir}\n`);

  locales.forEach((locale) => {
    const { base, missing, changed } = findOutdated(locale, sinceHash, source);

    const items = Object.keys(source)
      .filter((key) => missing.includes(key) || key in changed)
      .map((key) => ({
        key,
        context: comments[key] || undefined,
        en: source[key],
        ...(key in changed
          ? {
              previous_en: changed[key].previous,
              current_translation: changed[key].current,
            }
          : {}),
      }));

    writeFileSync(
      join(outDir, 'todo', `${locale}.todo.json`),
      `${JSON.stringify(items, null, 1)}\n`,
    );

    console.log(
      `${locale.padEnd(6)} ${String(missing.length).padStart(4)} missing` +
        `${String(Object.keys(changed).length).padStart(4)} changed` +
        `${base === sinceHash ? '' : `  (added in ${base?.slice(0, 9) ?? 'the working tree'})`}`,
    );
  });

  const brief = readFileSync(join(scriptsDir, 'sync-locales.md'), 'utf8')
    .replaceAll('%ROOT%', rootDir)
    .replaceAll('%OUT%', outDir);

  writeFileSync(join(outDir, 'BRIEF.md'), brief);
  console.log(`\nBrief for the translators: ${join(outDir, 'BRIEF.md')}`);

  return 0;
};

/**
 * Get the header comment of a locale file: the lines before the first section rule.
 * @param {string} source File content.
 * @returns {string} Header, or the whole file if it has no section rule.
 */
const getHeader = (source) => source.split(/^(?=# =+$)/m)[0];

/**
 * Merge the header of the source locale with a locale’s own. A header is made of paragraphs
 * separated by a blank line; the locale’s first paragraphs, as many as the source header has, are
 * its copy of the source header, which may be outdated, and the others are its own notes, which are
 * kept.
 * @param {string} sourceHeader Header of the rebuilt file, from the source locale.
 * @param {string} localeHeader Header of the locale’s current file.
 * @returns {string} Merged header.
 */
const mergeHeaders = (sourceHeader, localeHeader) => {
  /**
   * Split a header into paragraphs.
   * @param {string} header Header.
   * @returns {string[]} Paragraphs, without the blank lines.
   */
  const split = (header) =>
    header
      .trim()
      .split(/\n\s*\n/)
      .filter(Boolean);

  const sourceParagraphs = split(sourceHeader);

  const ownParagraphs = split(localeHeader)
    .slice(sourceParagraphs.length)
    .filter((paragraph) => !sourceParagraphs.includes(paragraph));

  return ownParagraphs.length
    ? `${[...sourceParagraphs, ...ownParagraphs].join('\n\n')}\n\n`
    : sourceHeader;
};

/**
 * Get the part of a comment that belongs to the section it opens: everything up to the last section
 * rule and the description that follows it, up to the first blank line.
 * @param {string} comment Comment above a key.
 * @returns {string} Section comment, or an empty string if the comment doesn’t open a section.
 */
const getSectionComment = (comment) => {
  const lines = comment.split('\n');
  const lastRule = lines.findLastIndex((line) => /^\s*=+\s*$/.test(line));

  if (lastRule === -1) {
    return '';
  }

  const blank = lines.findIndex((line, index) => index > lastRule && !line.trim());

  return lines.slice(0, blank === -1 ? lines.length : blank).join('\n');
};

/**
 * Read the translation files given to `apply`.
 * @param {string[]} paths JSON file paths.
 * @returns {Record<string, string>} Translations keyed by their full path; later files win.
 * @throws {Error} If a translation isn’t a string.
 */
const readTranslations = (paths) =>
  Object.assign(
    {},
    ...paths.map((path) => {
      /** @type {Record<string, unknown>} */
      const translations = JSON.parse(readFileSync(path, 'utf8'));

      if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
        throw new Error(`${path} must contain an object of translations keyed by their path.`);
      }

      const invalid = Object.keys(translations).find(
        (key) => typeof translations[key] !== 'string',
      );

      if (invalid) {
        throw new Error(`The translation of ${invalid} in ${path} is not a string.`);
      }

      return translations;
    }),
  );

/**
 * Run the `apply` command.
 * @param {string[]} args Command line arguments.
 * @returns {number} Exit code.
 */
const apply = ([locale, ...jsonPaths]) => {
  if (!locale || locale === SOURCE_LOCALE) {
    console.error('Usage: node scripts/sync-locales.js apply <locale> [<translations.json>…]');

    return 1;
  }

  const existingSource = readLocaleFile(locale);

  if (existingSource === null && !jsonPaths.length) {
    console.error(`Unknown locale: ${locale}. Pass translation files to add a new locale.`);

    return 1;
  }

  const localeSource = existingSource ?? '';

  /** @type {Record<string, string>} */
  const messages = {
    ...flattenMessages(parseYAML(localeSource)),
    ...readTranslations(jsonPaths),
  };

  const keys = Object.keys(messages);
  const sourceKeys = Object.keys(readSource());
  const knownKeys = keys.filter((key) => sourceKeys.includes(key));
  const unknownKeys = keys.filter((key) => !sourceKeys.includes(key));
  const doc = readSourceDocument();
  /** @type {string[]} */
  const missing = [];
  /**
   * Section heading and blank line of the pairs removed since the last kept one, to carry over.
   * @type {{ comment: string, spaceBefore: boolean } | null}
   */
  let pending = null;

  visit(doc, {
    /**
     * Fill a pair with its translation, or remove it, along with a map that would be left empty.
     * @param {unknown} _ Key of the pair in its parent, unused.
     * @param {import('yaml').Pair} pair Pair.
     * @param {readonly unknown[]} path Ancestors of the pair.
     * @returns {symbol | void} `visit.REMOVE` to remove the pair.
     */
    Pair: (_, pair, path) => {
      const key = getKey(pair, path);
      const keyNode = /** @type {Scalar} */ (pair.key);

      const translated = isMap(pair.value)
        ? knownKeys.some((k) => k.startsWith(`${key}.`))
        : key in messages;

      if (!translated) {
        if (isMap(pair.value)) {
          visit(pair.value, {
            /**
             * List the keys of the removed map as missing.
             * @param {unknown} __ Key of the pair in its parent, unused.
             * @param {import('yaml').Pair} child Pair.
             * @param {readonly unknown[]} childPath Ancestors of the pair within the map.
             */
            Pair: (__, child, childPath) => {
              if (isScalar(child.value)) {
                missing.push(`${key}.${getKey(child, childPath)}`);
              }
            },
          });
        } else {
          missing.push(key);
        }

        // Keep the heading of the section the removed pair opens, and the blank line before it
        pending = {
          comment: [pending?.comment, getSectionComment(keyNode.commentBefore ?? '')]
            .filter(Boolean)
            .join('\n\n'),
          spaceBefore: Boolean(pending?.spaceBefore || keyNode.spaceBefore),
        };

        return visit.REMOVE;
      }

      if (pending) {
        // Unless the pair opens a section of its own, which leaves the removed one empty
        if (pending.comment && !getSectionComment(keyNode.commentBefore ?? '')) {
          keyNode.commentBefore = [pending.comment, keyNode.commentBefore]
            .filter(Boolean)
            .join('\n\n');
        }

        keyNode.spaceBefore ||= pending.spaceBefore;
        pending = null;
      }

      if (isScalar(pair.value)) {
        const multiline = messages[key].trim().includes('\n');

        pair.value.value = multiline
          ? `${messages[key].replace(/\n*$/, '')}\n`
          : messages[key].replace(/\n+$/, '');
        pair.value.type = multiline ? Scalar.BLOCK_LITERAL : Scalar.PLAIN;
      }

      return undefined;
    },
  });

  let output = doc.toString({ lineWidth: 0, singleQuote: true });

  // Keep the locale’s own notes in its header
  if (localeSource && getHeader(localeSource) !== localeSource) {
    const header = getHeader(output);

    output = mergeHeaders(header, getHeader(localeSource)) + output.slice(header.length);
  }

  writeFileSync(join(localesDir, `${locale}.yaml`), output);

  if (unknownKeys.length) {
    console.log(`${locale}: ${unknownKeys.length} keys not in ${SOURCE_LOCALE}, ignored:`);
    unknownKeys.forEach((key) => console.log(`  ${key}`));
  }

  if (missing.length) {
    console.log(`${locale}: ${missing.length} keys left out, falling back to English:`);
    missing.forEach((key) => console.log(`  ${key}`));
  } else {
    console.log(`${locale}: complete`);
  }

  return 0;
};

/**
 * Run the command given on the command line.
 * @returns {number} Exit code.
 */
const main = () => {
  const [command, ...args] = process.argv.slice(2);

  try {
    if (command === 'todo') {
      return todo(args);
    }

    if (command === 'apply') {
      return apply(args);
    }
  } catch (/** @type {any} */ ex) {
    console.error(ex.message);

    return 1;
  }

  console.error('Usage: node scripts/sync-locales.js todo|apply …');

  return 1;
};

process.exit(main());
