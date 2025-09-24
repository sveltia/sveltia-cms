import { sveltePreprocess } from 'svelte-preprocess';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  preprocess: sveltePreprocess(),
  compilerOptions: {
    runes: true,
  },
};
