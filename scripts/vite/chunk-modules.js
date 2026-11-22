import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

import { compile, compileModule, parse as parseSvelte } from 'svelte/compiler';
import { parseAst } from 'vite';

import svelteConfig from '../../svelte.config.js';

/**
 * @typedef {object} SharedModule
 * @property {string} id Absolute path of a source module, or the specifier of a package module.
 * @property {string[]} names Names of the exports the chunks import from it, `default` included.
 */

/**
 * @typedef {object} ChunkModules
 * @property {Set<string>} mainFiles Absolute paths of the modules in the chunk directories that the
 * main bundle keeps, as the rest of the app imports them.
 * @property {Set<string>} ownFiles Absolute paths of the modules bundled into the chunks, the
 * entries included.
 * @property {SharedModule[]} sharedModules Modules the chunks import from the main bundle, in a
 * fixed order: the main bundle shares each with the export names in the same order, so a chunk can
 * take them by their positions.
 * @property {string} layoutId Hash of the modules and names in {@link sharedModules}, which tells a
 * chunk built along with another main bundle, e.g. an earlier release cached by the browser, from
 * one that takes the exports from the positions this one shares them at.
 */

/**
 * Root of the source modules, which the `$lib` alias points to.
 */
const LIB_DIR = path.resolve('src/lib');
/**
 * Suffixes tried in turn to resolve a source module specifier, as with the `resolve.extensions`
 * option of the build.
 */
const RESOLVE_SUFFIXES = ['', '.js', '.svelte', '/index.js'];

/**
 * Types of the syntax tree nodes that import a module: static imports, re-exports and dynamic
 * imports.
 */
const IMPORT_NODE_TYPES = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportAllDeclaration',
  'ImportExpression',
]);

/**
 * Whether the given specifier points to a source module rather than a package.
 * @param {string} specifier Module specifier.
 * @returns {boolean} Result.
 */
const isSourceSpecifier = (specifier) => specifier.startsWith('$lib/') || specifier.startsWith('.');

/**
 * Resolve a source module specifier to the absolute path of the file.
 * @param {string} specifier Module specifier, e.g. `$lib/services/config` or `./user.js`. A query,
 * e.g. `?only=additions` on a locale file, is kept on the path, as the build resolves it the same
 * way.
 * @param {string} importer Absolute path of the importing module.
 * @returns {string | undefined} File path, or `undefined` if no file matches.
 */
const resolveSourceModule = (specifier, importer) => {
  const [pathname, query] = specifier.split('?');

  const base = pathname.startsWith('$lib/')
    ? path.join(LIB_DIR, pathname.slice('$lib/'.length))
    : path.resolve(path.dirname(importer), pathname);

  const file = RESOLVE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );

  return file && query !== undefined ? `${file}?${query}` : file;
};

/**
 * Whether the given module is a data file, e.g. a locale file, which has no imports and is bundled
 * into each chunk that imports it, as a copy can’t hold state.
 * @param {string} file Absolute path of the module, possibly with a query.
 * @returns {boolean} Result.
 */
const isDataFile = (file) => /\.ya?ml(?:\?|$)/.test(file);

/**
 * Get the JavaScript code of a module as the build sees it: a Svelte component or a module that
 * uses runes is compiled first, with the options the build compiles it with, as the compiled code
 * imports the Svelte runtime as well.
 * @param {string} file Absolute path of the module.
 * @returns {string} Code.
 */
const getModuleCode = (file) => {
  const source = readFileSync(file, 'utf-8');
  const options = { filename: file, generate: /** @type {const} */ ('client'), dev: false };

  if (file.endsWith('.svelte')) {
    return compile(source, { ...svelteConfig.compilerOptions, ...options, css: 'injected' }).js
      .code;
  }

  if (file.endsWith('.svelte.js')) {
    return compileModule(source, options).js.code;
  }

  return source;
};

/**
 * Get the names of the members of a namespace that a module reads, e.g. `state` and `get` for
 * `$.state(0)` and `$.get(count)`, which is how compiled Svelte code uses its runtime.
 * @param {import('estree').Node} ast Program.
 * @param {string} namespace Local name of the namespace, e.g. `$`.
 * @returns {string[]} Names.
 * @throws {Error} If the namespace is used other than by reading a named member, e.g. passed on.
 */
const getNamespaceMembers = (ast, namespace) => {
  /** @type {Set<string>} */
  const names = new Set();

  /**
   * Walk a node and its descendants.
   * @param {any} node Node.
   * @param {any} [parent] Parent node.
   * @throws {Error} If the namespace is used other than by reading a named member.
   */
  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }

    if (node.type === 'Identifier' && node.name === namespace) {
      if (
        parent?.type === 'MemberExpression' &&
        parent.object === node &&
        !parent.computed &&
        parent.property.type === 'Identifier'
      ) {
        names.add(parent.property.name);
      } else if (parent?.type !== 'ImportNamespaceSpecifier') {
        throw new Error(`The ${namespace} namespace is used other than by reading a member`);
      }
    }

    Object.values(node).forEach((value) => {
      (Array.isArray(value) ? value : [value]).forEach((child) => {
        if (child && typeof child === 'object' && child !== parent) {
          walk(child, node);
        }
      });
    });
  };

  walk(ast);

  return [...names];
};

/**
 * List the source modules of the app, leaving out the tests.
 * @param {string} dir Directory to look in.
 * @returns {string[]} Absolute file paths.
 */
const listSourceModules = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:js|svelte)$/.test(entry.name))
    .filter((entry) => !entry.name.endsWith('.test.js'))
    .map((entry) => path.join(entry.parentPath, entry.name));

/**
 * Get the static imports and re-exports of a JavaScript module, along with the names it takes.
 * @param {string} file Absolute path of the module.
 * @returns {{ specifier: string, names: string[] }[]} Imports.
 * @throws {Error} If the module imports or re-exports a whole namespace, whose names can’t be told
 * without parsing the imported module too.
 */
const getImports = (file) => {
  const ast = parseAst(getModuleCode(file));

  return ast.body.flatMap((node) => {
    if (node.type === 'ImportDeclaration') {
      const specifier = /** @type {string} */ (node.source.value);

      return [
        {
          specifier,
          names: node.specifiers.flatMap((spec) => {
            if (spec.type === 'ImportNamespaceSpecifier') {
              // Compiled Svelte code takes its runtime as a namespace, whose members can be told
              // from how it’s used; a namespace of a source module would need parsing that too
              if (isSourceSpecifier(specifier)) {
                throw new Error(`Namespace import of ${specifier} in ${file}`);
              }

              return getNamespaceMembers(ast, spec.local.name);
            }

            return spec.type === 'ImportDefaultSpecifier'
              ? 'default'
              : /** @type {string} */ (
                  'name' in spec.imported ? spec.imported.name : spec.imported.value
                );
          }),
        },
      ];
    }

    if (node.type === 'ExportNamedDeclaration' && node.source) {
      return [
        {
          specifier: /** @type {string} */ (node.source.value),
          names: node.specifiers.map(
            (spec) =>
              /** @type {string} */ ('name' in spec.local ? spec.local.name : spec.local.value),
          ),
        },
      ];
    }

    if (node.type === 'ExportAllDeclaration') {
      throw new Error(`Namespace re-export of ${node.source.value} in ${file}`);
    }

    return [];
  });
};

/**
 * Collect the specifiers of the modules imported anywhere in a syntax tree, with a string literal.
 * @param {unknown} node Node, or an array or other value found in one.
 * @param {string[]} [specifiers] Specifiers collected so far.
 * @returns {string[]} Specifiers.
 */
const collectImportSpecifiers = (node, specifiers = []) => {
  if (Array.isArray(node)) {
    node.forEach((child) => collectImportSpecifiers(child, specifiers));
  } else if (node && typeof node === 'object') {
    const { type, source } = /** @type {{ type?: string, source?: { value?: unknown } }} */ (node);

    if (type && IMPORT_NODE_TYPES.has(type) && typeof source?.value === 'string') {
      specifiers.push(source.value);
    }

    Object.values(node).forEach((child) => collectImportSpecifiers(child, specifiers));
  }

  return specifiers;
};

/**
 * Get the specifiers of the static and dynamic imports and re-exports of a module or a Svelte
 * component, which is parsed with the Svelte compiler, as it can’t be parsed as JavaScript. The
 * comments are left out of the syntax tree, so a JSDoc `@import` tag or `{import('…')}` type, which
 * only imports types, isn’t counted.
 * @param {string} file Absolute path of the module.
 * @returns {string[]} Specifiers.
 */
const getImportSpecifiers = (file) => {
  const source = readFileSync(file, 'utf-8');

  return collectImportSpecifiers(
    file.endsWith('.svelte') ? parseSvelte(source, { modern: true }) : parseAst(source),
  );
};

/**
 * Get the names a declaration binds, including those in a destructuring pattern.
 * @param {import('estree').Pattern} pattern Declared pattern, e.g. `a` or `{ a, b: [c] }`.
 * @returns {string[]} Names.
 */
const getBoundNames = (pattern) => {
  switch (pattern.type) {
    case 'Identifier':
      return [pattern.name];
    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        getBoundNames(property.type === 'RestElement' ? property : property.value),
      );
    case 'ArrayPattern':
      return pattern.elements.flatMap((element) => (element ? getBoundNames(element) : []));
    case 'RestElement':
      return getBoundNames(pattern.argument);
    case 'AssignmentPattern':
      return getBoundNames(pattern.left);
    default:
      return [];
  }
};

/**
 * Make sure a module the main bundle shares with the chunks doesn’t export any of the given names
 * as a top-level `let` or `var`. The main bundle shares the value each export has when it starts,
 * so a chunk would never see a later assignment, unlike an import of the module itself.
 * @param {string} file Absolute path of the module.
 * @param {string[]} names Names of the exports the chunks import.
 * @throws {Error} If one of them is a variable that can be reassigned.
 */
const assertConstantExports = (file, names) => {
  if (!file.endsWith('.js')) {
    return;
  }

  /** @type {Set<string>} */
  const variables = new Set();
  /** @type {Map<string, string>} */
  const locals = new Map();

  parseAst(readFileSync(file, 'utf-8')).body.forEach((node) => {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (declaration?.type === 'VariableDeclaration') {
      declaration.declarations
        .flatMap(({ id }) => getBoundNames(id))
        .forEach((name) => {
          if (declaration.kind !== 'const') {
            variables.add(name);
          }

          if (node.type === 'ExportNamedDeclaration') {
            locals.set(name, name);
          }
        });
    }

    if (node.type === 'ExportNamedDeclaration' && !node.source) {
      node.specifiers.forEach(({ local, exported }) => {
        if ('name' in local && 'name' in exported) {
          locals.set(exported.name, local.name);
        }
      });
    }
  });

  names.forEach((name) => {
    if (variables.has(/** @type {string} */ (locals.get(name)))) {
      throw new Error(`${name}, exported by ${file} and imported by a chunk, can be reassigned`);
    }
  });
};

/**
 * Tell which modules the chunks built from the given entries bundle themselves and which they take
 * from the main bundle. A chunk owns the modules in its directories, except those the rest of the
 * app imports as well, e.g. the constants of a backend that the configuration parser checks, and
 * the modules those import in turn: they’re in the main bundle anyway, and a second copy of a
 * module that holds state would not share it. Everything else a chunk imports, packages included,
 * comes from the main bundle.
 * @param {object} args Arguments.
 * @param {string[]} args.entries Paths of the chunk entries, e.g. `src/lib/chunks/gitlab.js`.
 * @param {string[]} args.ownDirs Paths of the directories whose modules the chunks own.
 * @returns {ChunkModules} Modules.
 * @throws {Error} If a module can’t be resolved or analyzed, or the main bundle can’t share one of
 * the exports a chunk imports, see {@link assertConstantExports}.
 */
export const getChunkModules = ({ entries, ownDirs }) => {
  const entryFiles = entries.map((entry) => path.resolve(entry));
  const dirs = ownDirs.map((dir) => `${path.resolve(dir)}${path.sep}`);
  /**
   * Whether the given file is in one of the directories the chunks own.
   * @param {string} file Absolute file path.
   * @returns {boolean} Result.
   */
  const isInOwnDir = (file) => dirs.some((dir) => file.startsWith(dir));
  /** @type {Set<string>} */
  const mainFiles = new Set();
  /** @type {string[]} */
  const mainQueue = [];

  // Find the modules in the chunk directories that the rest of the app imports
  listSourceModules(LIB_DIR)
    .filter((file) => !isInOwnDir(file) && !entryFiles.includes(file))
    .forEach((file) => {
      getImportSpecifiers(file).forEach((specifier) => {
        const resolved = isSourceSpecifier(specifier)
          ? resolveSourceModule(specifier, file)
          : undefined;

        if (resolved && isInOwnDir(resolved) && !mainFiles.has(resolved)) {
          mainFiles.add(resolved);
          mainQueue.push(resolved);
        }
      });
    });

  // Along with the modules in the chunk directories that those import
  while (mainQueue.length) {
    const file = /** @type {string} */ (mainQueue.shift());

    (isDataFile(file) ? [] : getImports(file)).forEach(({ specifier }) => {
      const resolved = isSourceSpecifier(specifier)
        ? resolveSourceModule(specifier, file)
        : undefined;

      if (resolved && isInOwnDir(resolved) && !mainFiles.has(resolved)) {
        mainFiles.add(resolved);
        mainQueue.push(resolved);
      }
    });
  }

  const ownFiles = new Set(entryFiles);
  const ownQueue = [...entryFiles];
  /** @type {Map<string, Set<string>>} */
  const sharedNames = new Map();

  while (ownQueue.length) {
    const file = /** @type {string} */ (ownQueue.shift());

    getImports(file).forEach(({ specifier, names }) => {
      const id = isSourceSpecifier(specifier) ? resolveSourceModule(specifier, file) : specifier;

      if (!id) {
        throw new Error(`Cannot resolve ${specifier} in ${file}`);
      }

      // A data file is bundled wherever it’s imported, under its own query, e.g. the part of a
      // locale file a chunk needs
      if (isDataFile(id)) {
        ownFiles.add(id);

        return;
      }

      if (isInOwnDir(id) && !mainFiles.has(id)) {
        if (!ownFiles.has(id)) {
          ownFiles.add(id);
          ownQueue.push(id);
        }

        return;
      }

      const set = sharedNames.get(id) ?? new Set();

      names.forEach((name) => set.add(name));
      sharedNames.set(id, set);
    });
  }

  const sharedModules = [...sharedNames.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, names]) => ({ id, names: [...names].sort() }));

  sharedModules.forEach(({ id, names }) => {
    if (path.isAbsolute(id)) {
      assertConstantExports(id, names);
    }
  });

  const layoutId = createHash('sha256')
    .update(
      JSON.stringify(
        sharedModules.map(({ id, names }) => [
          path.isAbsolute(id) ? path.relative(LIB_DIR, id) : id,
          names,
        ]),
      ),
    )
    .digest('hex')
    .slice(0, 12);

  return { mainFiles, ownFiles, sharedModules, layoutId };
};
