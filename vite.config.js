import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Output JavaScript only
      input: 'src/main.js',
      output: {
        entryFileNames: 'sveltia-cms.js',
      },
    },
  },
  plugins: [
    svelte({
      emitCss: false,
      preprocess: sveltePreprocess(),
    }),
  ],
});
