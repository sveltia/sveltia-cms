import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
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
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
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
