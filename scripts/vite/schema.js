import { exec } from 'child_process';
import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import { promisify } from 'util';

import { isObject } from '@sveltia/utils/object';
import { createGenerator } from 'ts-json-schema-generator';

// eslint-disable-next-line import-x/no-useless-path-segments
import { BUILTIN_FIELD_TYPES } from '../../src/lib/services/contents/fields/index.js';

import { virtualModule } from './utils.js';

/**
 * Path to the generated main type declaration file.
 */
const MAIN_TYPE_PATH = 'package/main.d.ts';
/**
 * Path to the generated public type declaration file.
 */
const PUBLIC_TYPE_PATH = 'package/types/public.d.ts';
/**
 * Path to the generated JSON schema for the CMS configuration.
 */
const SCHEMA_PATH = 'package/schema/sveltia-cms.json';

/**
 * Generate TypeScript type declaration files from JSDoc comments. This produces `main.d.ts` and
 * `types/public.d.ts`.
 * @throws {Error} If the compiler fails, rather than leave the files of an earlier build behind.
 * @see https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html
 */
export const generateTypes = async () => {
  const command =
    'tsc src/lib/main.js --allowJs --declaration --emitDeclarationOnly --outDir package';

  try {
    await promisify(exec)(command);
  } catch (/** @type {any} */ ex) {
    // The compiler reports its errors on the standard output
    throw new Error(`Failed to generate the type declarations:\n${ex.stdout || ex.message}`);
  }

  // Re-export all types from `types/public.d.ts` in `main.d.ts` for better DX
  await appendFile(MAIN_TYPE_PATH, "export type * from './types/public';\n");

  const publicType = await readFile(PUBLIC_TYPE_PATH, 'utf-8');

  // Replace `DEPRECATED:` with proper `@deprecated` tag. This is needed because JSDoc comments
  // cannot have the `@deprecated` tag for each property in a typedef.
  await writeFile(PUBLIC_TYPE_PATH, publicType.replaceAll('DEPRECATED:', '@deprecated'));
};

/**
 * Schema keywords that document the configuration for an editor but have no effect on validation.
 */
const SCHEMA_ANNOTATIONS = [
  'title',
  'description',
  'markdownDescription',
  'deprecated',
  'deprecationMessage',
];

/**
 * Keywords whose value maps names to nested schemas. A key there is a configuration option name,
 * not a schema keyword, and `description` happens to be one of those options, so the keys are kept.
 */
const SCHEMA_MAPS = ['properties', 'definitions'];
/**
 * Keywords whose value is data rather than a nested schema, so it’s copied over untouched.
 */
const SCHEMA_VALUES = ['const', 'enum', 'required'];

/**
 * Remove the documentation from a schema, leaving only what affects validation.
 * @param {any} node Schema node.
 * @returns {any} Node without annotations.
 */
const stripSchemaAnnotations = (node) => {
  if (Array.isArray(node)) {
    return node.map(stripSchemaAnnotations);
  }

  if (!isObject(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(/** @type {Record<string, any>} */ (node))
      .filter(([key]) => !SCHEMA_ANNOTATIONS.includes(key))
      .map(([key, value]) => {
        if (SCHEMA_VALUES.includes(key)) {
          return [key, value];
        }

        if (SCHEMA_MAPS.includes(key) && isObject(value)) {
          return [
            key,
            Object.fromEntries(
              Object.entries(/** @type {Record<string, any>} */ (value)).map(([name, nested]) => [
                name,
                stripSchemaAnnotations(nested),
              ]),
            ),
          ];
        }

        return [key, stripSchemaAnnotations(value)];
      }),
  );
};

/**
 * Generate JSON schema for the Sveltia CMS configuration from TypeScript types. This schema is used
 * to validate the `config.yml` file within VS Code and other tools that support JSON schema
 * validation. The type declarations have to be generated first, see {@link generateTypes}.
 * @see https://github.com/vega/ts-json-schema-generator
 * @see https://www.schemastore.org/netlify.json - Legacy Netlify CMS config schema
 * @see https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json - Our published schema
 */
export const generateSchema = async () => {
  const config = {
    path: PUBLIC_TYPE_PATH,
    type: 'CmsConfig',
    // `markdownDescription` is a VS Code schema extension
    // https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings
    markdownDescription: true,
  };

  const schema = {
    ...createGenerator(config).createSchema(config.type),
    title: 'Sveltia CMS Configuration',
    description: 'Sveltia CMS configuration file',
  };

  // Allow having the `$schema` property at the top of the config file
  // https://json-schema.org/understanding-json-schema/keywords
  schema.definitions.CmsConfig.properties.$schema = { type: 'string', format: 'uri' };

  // Require at least one of `collections` or `singletons`
  schema.definitions.CmsConfig.anyOf = [
    { required: ['collections'] },
    { required: ['singletons'] },
  ];

  // Disallow built-in field type names for custom fields. We need this because the `Exclude` type
  // utility used in the TypeScript definition is not converted to JSON schema.
  // @see https://github.com/vega/ts-json-schema-generator/issues/993
  Object.assign(schema.definitions.CustomField.properties.widget, {
    minLength: 1,
    not: { enum: BUILTIN_FIELD_TYPES },
  });

  const schemaString = JSON.stringify(schema)
    // Remove unnecessary escaped line breaks in `markdownDescription` originally present in JSDoc,
    // leaving a literal `\n` written in the description alone: it’s encoded as an escaped backslash
    // followed by `n`, which would otherwise lose the `n` and leave a bad escape sequence behind
    .replace(/(?<!\\)((?:\\\\)*)\\n/g, '$1 ')
    // Use the proper boolean `deprecated` property instead of a string and append a separate
    // message property. `deprecationMessage` is a VS Code schema extension
    .replace(/"deprecated":"(.+?)"/g, '"deprecated":true,"deprecationMessage":"$1"');

  await mkdir('package/schema', { recursive: true });
  await writeFile(SCHEMA_PATH, schemaString);
};

/**
 * Bundle the configuration schema with the app, stripped of the documentation that only an editor
 * needs. Validation then costs nothing at runtime beyond the few kilobytes the schema compresses
 * to, and it works offline and under a content security policy that blocks the CDN.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const bundleSchema = () =>
  virtualModule({
    name: 'bundle-schema',
    id: 'virtual:config-schema',
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: async () => {
      // A build writes the schema in `buildStart`, before any module is loaded. The dev server
      // doesn’t, to keep startup quick, so it reuses whatever the last build left behind — and
      // exports nothing at all if there was none, which turns validation off.
      if (!existsSync(SCHEMA_PATH)) {
        return 'export default null;';
      }

      const schema = stripSchemaAnnotations(JSON.parse(await readFile(SCHEMA_PATH, 'utf-8')));

      return `export default ${JSON.stringify(schema)};`;
    },
  });
