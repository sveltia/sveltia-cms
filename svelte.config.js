/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  compilerOptions: {
    runes: true,
    /**
     * Skip the bidi warning in component tests. They assert the bidi isolates wrapped around an
     * interpolated value, written as Unicode escapes, which the compiler still flags because it
     * checks the decoded string.
     * @param {import('svelte/compiler').Warning} warning Compiler warning.
     * @returns {boolean} Whether to keep the warning.
     */
    warningFilter: ({ code, filename }) =>
      !(code === 'bidirectional_control_characters' && filename?.endsWith('.svelte.test.js')),
  },
};
