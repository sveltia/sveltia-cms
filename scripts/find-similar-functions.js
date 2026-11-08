#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Find functions that look alike in Sveltia CMS, to spot logic that has been written more than
 * once and has drifted apart since.
 *
 * `pnpm check:duplicates` (jscpd) finds copy-paste: long runs of identical tokens. Two functions
 * written for the same job in different places rarely share such a run once one of them has been
 * fixed or extended, so they slip through. This script compares every function in `src/lib`,
 * including those in `.svelte` components, by the overlap of their token sequences instead:
 * identifiers are normalized, except property names, so `getFoo(a.b)` and `getBar(c.b)` count as
 * the same shape. The pairs are ranked by their Jaccard similarity, weighted by size.
 *
 * It only reports; a pair can be a genuine duplicate, a parallel implementation that should share a
 * helper, or two functions that merely look alike. Read both sides before acting on a row.
 *
 * Usage: node scripts/find-similar-functions.js [--min-score 0.45] [--min-tokens 45] [--limit 100].
 *
 * Options:
 * --min-score   Lowest similarity to report, from 0 to 1. Default: 0.45
 * --min-tokens  Smallest function to compare, in tokens. Default: 45
 * --limit       Number of pairs to print. Default: 100; `0` prints them all.
 *
 * Output: one pair per line, `score size  a <-> b`, where `size` is the token count of the smaller
 * function, and `a` and `b` are `path:startLine-endLine name` relative to `src/lib`.
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

import { parse as parseSvelte } from 'svelte/compiler';
import ts from 'typescript';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sourceRoot = join(__dirname, '..', 'src', 'lib');
/**
 * Command line options.
 * @type {Record<string, string>}
 */
let options = {};

try {
  options = /** @type {Record<string, string>} */ (
    parseArgs({
      options: {
        'min-score': { type: 'string', default: '0.45' },
        'min-tokens': { type: 'string', default: '45' },
        limit: { type: 'string', default: '100' },
      },
    }).values
  );
} catch (/** @type {any} */ ex) {
  // An unknown option or a missing value
  console.error(ex.message);
  process.exit(1);
}

/**
 * Get the value of a numeric command line option, or exit if it isn’t a number.
 * @param {'min-score' | 'min-tokens' | 'limit'} name Option name.
 * @returns {number} Value.
 */
const getNumberOption = (name) => {
  const value = Number(options[name]);

  if (Number.isNaN(value)) {
    console.error(`--${name} takes a number, not “${options[name]}”.`);
    process.exit(1);
  }

  return value;
};

const MIN_SCORE = getNumberOption('min-score');
const MIN_TOKENS = getNumberOption('min-tokens');
const LIMIT = getNumberOption('limit');
/**
 * Number of consecutive tokens compared at a time.
 */
const SHINGLE_SIZE = 5;
/**
 * A token sequence found in more functions than this is boilerplate, like the start of an arrow
 * function destructuring its argument, `= ( { I , I`, and is left out of the comparison so it
 * doesn’t make unrelated functions look alike.
 */
const COMMON_SHINGLE_LIMIT = 40;
/**
 * Folders and files to skip, like jscpd’s configuration in `.jscpd.json`.
 */
const IGNORED_NAME_REGEX = /^(locales|test)$|\.test\.js$/;

/**
 * @typedef {object} FunctionInfo
 * @property {string} file File path relative to `src/lib`.
 * @property {string} name Function name, or the name of the variable or property holding it.
 * @property {number} start Start offset within the file.
 * @property {number} end End offset within the file.
 * @property {number} startLine First line, 1-based.
 * @property {number} endLine Last line, 1-based.
 * @property {number} tokenCount Number of tokens.
 * @property {Set<string>} shingles Token sequences of {@link SHINGLE_SIZE} tokens.
 */

/**
 * List the JavaScript and Svelte files under the given folder.
 * @param {string} dir Folder path.
 * @returns {Promise<string[]>} File paths.
 */
const listFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });

  const lists = await Promise.all(
    entries
      .filter(({ name }) => !IGNORED_NAME_REGEX.test(name))
      .map(async (entry) => {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
          return listFiles(path);
        }

        return /\.(js|svelte)$/.test(entry.name) ? [path] : [];
      }),
  );

  return lists.flat();
};

/**
 * Get the scripts of a file: the whole file for JavaScript, or each `<script>` block of a Svelte
 * component, with the offset it starts at.
 * @param {string} path File path.
 * @param {string} source File content.
 * @returns {{ code: string, offset: number }[]} Scripts.
 */
const getScripts = (path, source) => {
  if (!path.endsWith('.svelte')) {
    return [{ code: source, offset: 0 }];
  }

  const { instance, module } = parseSvelte(source, { modern: true });

  return [instance, module]
    .filter((script) => !!script)
    .map(({ content: { start, end } }) => ({ code: source.slice(start, end), offset: start }));
};

/**
 * Check whether the given node is part of a JSDoc comment, which isn’t compared.
 * @param {ts.Node} node Node.
 * @returns {boolean} Result.
 */
const isJSDocNode = ({ kind }) =>
  kind >= ts.SyntaxKind.FirstJSDocNode && kind <= ts.SyntaxKind.LastJSDocNode;

/**
 * Normalize a token, so that functions doing the same thing with different names compare equal.
 * Identifiers become `I` and literals `S` or `N`, but a property name is kept, as calling `.push()`
 * or reading `.length` says a lot about what a function does.
 * @param {ts.Node} node Leaf node.
 * @param {ts.Node | undefined} previous Previous leaf node.
 * @returns {string} Token.
 */
const normalizeToken = (node, previous) => {
  const { kind } = node;

  if (kind === ts.SyntaxKind.Identifier || kind === ts.SyntaxKind.PrivateIdentifier) {
    const afterDot =
      previous?.kind === ts.SyntaxKind.DotToken ||
      previous?.kind === ts.SyntaxKind.QuestionDotToken;

    return afterDot ? `.${node.getText()}` : 'I';
  }

  if (kind === ts.SyntaxKind.NumericLiteral || kind === ts.SyntaxKind.BigIntLiteral) {
    return 'N';
  }

  if (
    kind === ts.SyntaxKind.StringLiteral ||
    kind === ts.SyntaxKind.RegularExpressionLiteral ||
    (kind >= ts.SyntaxKind.FirstTemplateToken && kind <= ts.SyntaxKind.LastTemplateToken)
  ) {
    return 'S';
  }

  return ts.tokenToString(kind) ?? String(kind);
};

/**
 * Check whether the given leaf node is a token to compare. An empty list, like the parameters of
 * `() =>`, and the end of the file are leaves too, but not tokens of the code.
 * @param {ts.Node} node Leaf node.
 * @returns {boolean} Result.
 */
const isComparedToken = ({ kind }) =>
  kind >= ts.SyntaxKind.FirstToken &&
  kind <= ts.SyntaxKind.LastToken &&
  kind !== ts.SyntaxKind.EndOfFileToken;

/**
 * Find the first of the given leaves starting at or after the given position.
 * @param {{ start: number }[]} leaves Leaves, in source order.
 * @param {number} position Position.
 * @returns {number} Index, or the number of leaves if there is none.
 */
const findFirstLeaf = (leaves, position) => {
  let low = 0;
  let high = leaves.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (leaves[middle].start < position) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
};

/**
 * Check whether the given node declares a name a function can go by: the function itself, or the
 * variable, property or method holding it. A property access, like `map` in `a.filter(…).map`,
 * has a name too, but not one of the function’s.
 * @param {ts.Node} node Node.
 * @returns {boolean} Result.
 */
const isNamingNode = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ts.isVariableDeclaration(node) ||
  ts.isPropertyAssignment(node) ||
  ts.isPropertyDeclaration(node) ||
  ts.isClassDeclaration(node);

/**
 * Get the name a function goes by: its own, or that of the variable, property or method holding
 * it. A callback, e.g. one passed to `createDerivedState()` or `map()`, goes by the name of what
 * it’s found in, followed by `>`.
 * @param {ts.Node} node Function node.
 * @returns {string} Name, or `<anonymous>`.
 */
const getFunctionName = (node) => {
  /** @type {ts.Node | undefined} */
  let current = node;
  let nested = false;

  while (current && !ts.isSourceFile(current)) {
    const { name } = /** @type {{ name?: ts.Node }} */ (current);

    if (isNamingNode(current) && name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name))) {
      return nested ? `${name.text} >` : name.text;
    }

    // Anything but the variable or property holding the function, or a type cast around it, makes
    // the function a callback of what’s further up
    if (current !== node && !ts.isParenthesizedExpression(current)) {
      nested = true;
    }

    current = current.parent;
  }

  return '<anonymous>';
};

/**
 * Collect the functions of a script along with their tokens.
 * @param {object} args Arguments.
 * @param {string} args.file File path relative to `src/lib`.
 * @param {string} args.source Whole file content, to count the lines with.
 * @param {string} args.code Script content.
 * @param {number} args.offset Offset of the script within the file.
 * @returns {FunctionInfo[]} Functions.
 */
const collectFunctions = ({ file, source, code, offset }) => {
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );

  /** @type {{ node: ts.Node, start: number, end: number, token: string }[]} */
  const leaves = [];
  /** @type {ts.Node[]} */
  const functionNodes = [];

  /**
   * Walk the syntax tree, collecting the leaf tokens in order and the function nodes.
   * @param {ts.Node} node Node.
   */
  const walk = (node) => {
    if (isJSDocNode(node)) {
      return;
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      functionNodes.push(node);
    }

    const children = node.getChildren(sourceFile);

    if (!children.length) {
      if (isComparedToken(node)) {
        leaves.push({
          node,
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          token: normalizeToken(node, leaves.at(-1)?.node),
        });
      }

      return;
    }

    children.forEach(walk);
  };

  walk(sourceFile);

  // Number of lines in the file before the script, which a Svelte component starts with
  const lineOffset = source.slice(0, offset).split('\n').length - 1;

  /**
   * Get the 1-based line number of an offset within the file.
   * @param {number} position Offset within the script.
   * @returns {number} Line number.
   */
  const getLine = (position) =>
    lineOffset + sourceFile.getLineAndCharacterOfPosition(position).line + 1;

  return functionNodes.flatMap((node) => {
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    /** @type {string[]} */
    const tokens = [];

    // The leaves are in source order, so the function’s tokens are the run from the first one at
    // or after its start
    for (let index = findFirstLeaf(leaves, start); leaves[index]?.end <= end; index += 1) {
      tokens.push(leaves[index].token);
    }

    if (tokens.length < MIN_TOKENS) {
      return [];
    }

    /** @type {Set<string>} */
    const shingles = new Set();

    for (let index = 0; index + SHINGLE_SIZE <= tokens.length; index += 1) {
      shingles.add(tokens.slice(index, index + SHINGLE_SIZE).join(' '));
    }

    return [
      {
        file,
        name: getFunctionName(node),
        start: offset + start,
        end: offset + end,
        startLine: getLine(start),
        endLine: getLine(end),
        tokenCount: tokens.length,
        shingles,
      },
    ];
  });
};

/**
 * Check whether a function contains another one, or is the same one.
 * @param {FunctionInfo} outer Function.
 * @param {FunctionInfo} inner Another function.
 * @returns {boolean} Result.
 */
const contains = (outer, inner) =>
  outer.file === inner.file && outer.start <= inner.start && inner.end <= outer.end;

/**
 * Check whether one function contains the other, like a callback within its caller, which would
 * otherwise be reported as a match.
 * @param {FunctionInfo} a Function.
 * @param {FunctionInfo} b Another function.
 * @returns {boolean} Result.
 */
const isNested = (a, b) => contains(a, b) || contains(b, a);

/**
 * Check whether a pair echoes another one: its functions are within those of the other, or the
 * other way round, like the similar callbacks of two similar functions.
 * @param {{ a: FunctionInfo, b: FunctionInfo }} pair Pair.
 * @param {{ a: FunctionInfo, b: FunctionInfo }} other Another pair.
 * @returns {boolean} Result.
 */
const isEcho = ({ a, b }, other) =>
  [
    [a, b],
    [b, a],
  ].some(
    ([x, y]) =>
      (contains(other.a, x) && contains(other.b, y)) ||
      (contains(x, other.a) && contains(y, other.b)),
  );

/**
 * Find the pairs of similar functions.
 * @param {FunctionInfo[]} functions Functions.
 * @returns {{ score: number, size: number, a: FunctionInfo, b: FunctionInfo }[]} Pairs, the most
 * similar and largest first, leaving out those echoing a pair listed before.
 */
const findSimilarPairs = (functions) => {
  /** @type {Map<string, number[]>} */
  const index = new Map();

  functions.forEach(({ shingles }, functionIndex) => {
    shingles.forEach((shingle) => {
      const list = index.get(shingle) ?? [];

      list.push(functionIndex);
      index.set(shingle, list);
    });
  });

  // Leave out the boilerplate shared by many functions
  index.forEach((list, shingle) => {
    if (list.length > COMMON_SHINGLE_LIMIT) {
      list.forEach((functionIndex) => functions[functionIndex].shingles.delete(shingle));
      index.delete(shingle);
    }
  });

  /** @type {Map<string, number>} */
  const sharedCounts = new Map();

  index.forEach((list) => {
    list.forEach((a, i) => {
      list.slice(i + 1).forEach((b) => {
        const key = `${a}:${b}`;

        sharedCounts.set(key, (sharedCounts.get(key) ?? 0) + 1);
      });
    });
  });

  const ranked = [...sharedCounts]
    .map(([key, shared]) => {
      const [a, b] = key.split(':').map((i) => functions[Number(i)]);
      const score = shared / (a.shingles.size + b.shingles.size - shared);

      return { score, size: Math.min(a.tokenCount, b.tokenCount), a, b };
    })
    .filter(({ score, a, b }) => score >= MIN_SCORE && !isNested(a, b))
    .sort((x, y) => y.score * Math.sqrt(y.size) - x.score * Math.sqrt(x.size));

  /** @type {typeof ranked} */
  const pairs = [];

  // Report a match once, at its highest-ranked pair
  ranked.forEach((pair) => {
    if (!pairs.some((other) => isEcho(pair, other))) {
      pairs.push(pair);
    }
  });

  return pairs;
};

/**
 * Format a function for the report.
 * @param {FunctionInfo} info Function.
 * @returns {string} `path:startLine-endLine name`.
 */
const formatFunction = ({ file, startLine, endLine, name }) =>
  `${file}:${startLine}-${endLine} ${name}`;

const files = await listFiles(sourceRoot);

const functions = (
  await Promise.all(
    files.map(async (path) => {
      const source = await readFile(path, 'utf8');
      const file = relative(sourceRoot, path);

      return getScripts(path, source).flatMap(({ code, offset }) =>
        collectFunctions({ file, source, code, offset }),
      );
    }),
  )
).flat();

const pairs = findSimilarPairs(functions);

console.log(
  `Compared ${functions.length} functions of ${MIN_TOKENS}+ tokens in ${files.length} files; ` +
    `${pairs.length} pairs scored ${MIN_SCORE} or more.\n`,
);

(LIMIT > 0 ? pairs.slice(0, LIMIT) : pairs).forEach(({ score, size, a, b }) => {
  const scoreColumn = `${score.toFixed(2)} ${String(size).padStart(4)}`;

  console.log(`${scoreColumn}  ${formatFunction(a)}  <->  ${formatFunction(b)}`);
});
