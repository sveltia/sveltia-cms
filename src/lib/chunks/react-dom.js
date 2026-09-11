/**
 * Entry point of the `react-dom` chunk, built separately from the main bundle and loaded on demand
 * by `loadReactDom()`, as only the Netlify/Decap CMS-compatible API needs it. In this build, the
 * `react` package resolves to the React instance the main bundle shares on `globalThis`, so the
 * elements created there render here. See `buildChunks()` in `vite.config.js`.
 */
export { createRoot } from 'react-dom/client';
