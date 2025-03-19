import { svelte } from '@sveltejs/vite-plugin-svelte';
import { existsSync } from 'fs';
import { cp, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { sveltePreprocess } from 'svelte-preprocess';
import { defineConfig } from 'vite';

/**
 * Copy essential package files while modifying the `package.json` content.
 * @returns {import('vite').Plugin} Vite plugin.
 */
const copyPackageFiles = () => ({
  name: 'copy-package-files',
  buildStart: {
    async: true,
    sequential: false,
    // eslint-disable-next-line jsdoc/require-jsdoc
    handler: async () => {
      const packageJson = JSON.parse(await readFile('package.json'));

      // Remove unnecessary properties as we only publish compiled bundles
      delete packageJson.dependencies;
      delete packageJson.devDependencies;
      delete packageJson.scripts;

      // Add properties for distribution; paths are relative to `package`
      Object.assign(packageJson, {
        files: ['dist'],
        main: './dist/sveltia-cms.mjs',
        module: './dist/sveltia-cms.mjs',
        exports: {
          '.': {
            default: './dist/sveltia-cms.mjs',
          },
        },
      });

      if (!existsSync('package')) {
        await mkdir('package');
      }

      await Promise.all([
        writeFile('package/package.json', JSON.stringify(packageJson, null, 2).concat('\n')),
        cp('LICENSE.txt', 'package/LICENSE.txt'),
        cp('README.md', 'package/README.md'),
      ]);
    },
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib/'),
    },
    extensions: ['.js', '.svelte'],
  },
  build: {
    target: 'es2022',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
    sourcemap: true,
    rollupOptions: {
      // Output JavaScript only
      input: 'src/lib/main.js',
      output: [
        {
          entryFileNames: 'sveltia-cms.js',
          format: 'iife',
        },
        {
          entryFileNames: 'sveltia-cms.mjs',
          format: 'es',
        },
      ],
      // Keep exports in the ES module
      // https://stackoverflow.com/q/71500190
      preserveEntrySignatures: 'strict',
    },
    outDir: 'package/dist',
  },
  // https://esbuild.github.io/api/#legal-comments
  esbuild: { legalComments: 'eof' },
  plugins: [
    svelte({
      emitCss: false,
      preprocess: sveltePreprocess(),
      compilerOptions: {
        runes: true,
      },
    }),
    copyPackageFiles(),
  ],
});
