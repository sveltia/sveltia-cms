import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
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
      input: 'src/main.js',
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
  },
  // https://esbuild.github.io/api/#legal-comments
  esbuild: { legalComments: 'eof' },
  plugins: [
    svelte({
      emitCss: false,
      preprocess: sveltePreprocess(),
    }),
    // https://www.npmjs.com/package/rollup-plugin-visualizer
    visualizer({
      filename: '.vite/stats.html',
    }),
  ],
});
