/**
 * Entry point of the `gitea` chunk, built separately from the main bundle and loaded on demand, as
 * only a site configured with the Gitea or Forgejo backend needs it. The modules it shares with the
 * rest of the app come from the main bundle, see `shareMainModules()` in `scripts/vite/chunks.js`.
 */
export { default as gitea, forgejo } from '$lib/services/backends/git/gitea';
