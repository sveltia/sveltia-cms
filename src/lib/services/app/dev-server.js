/**
 * Documentation explaining why the CMS must be served as a static file.
 */
export const LIVE_RELOAD_DOCS_URL =
  'https://sveltiacms.app/en/docs/workflows/local#troubleshooting';

/**
 * Check if the CMS is running on a page that a framework’s development server renders and reloads
 * on every file change, e.g. `src/pages/admin.astro` with Astro, instead of a static HTML file such
 * as `public/admin/index.html`. Vite, which powers Astro, SvelteKit, Nuxt, VitePress and others,
 * injects its client script into such a page, which then reloads while the CMS is writing files
 * with the local backend, leaving a file empty or a temporary file behind.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/issues/1061
 */
export const isLiveReloadedPage = () =>
  // The CMS’s own development server injects the script too
  !import.meta.env.DEV && !!document.querySelector('script[src*="/@vite/client"]');
