import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cp, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { sveltePreprocess } from 'svelte-preprocess';
import { defineConfig } from 'vite';

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
    {
      name: 'copy-package-files',
      closeBundle: {
        async: true,
        sequential: true,
        // eslint-disable-next-line jsdoc/require-jsdoc
        handler: async () => {
          const packageJson = JSON.parse(await readFile('package.json'));

          // Remove unnecessary properties as we only publish compiled bundles
          delete packageJson.dependencies;
          delete packageJson.devDependencies;
          delete packageJson.scripts;

          await writeFile('package/package.json', JSON.stringify(packageJson, null, 2));
          await cp('LICENSE.txt', 'package/LICENSE.txt');
          await cp('README.md', 'package/README.md');
        },
      },
    },
  ],
});
