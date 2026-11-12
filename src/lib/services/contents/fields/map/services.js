import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadChunk } from '$lib/services/app/dependencies';

/**
 * @import { LazyModule } from '$lib/services/api/lazy-module';
 */

/**
 * @typedef {typeof import('$lib/chunks/map')} MapServices
 */

/**
 * Loader of the Map field services. Few sites have the field, so the services are kept in the `map`
 * chunk and fetched when a Map field editor is opened. This module is imported by the editor, so it
 * stays in the main bundle while the rest of the directory goes into the chunk, see
 * `getChunkModules()` in `scripts/vite/chunk-modules.js`.
 * @type {LazyModule<MapServices>}
 */
export const mapServices = createLazyModule({
  /**
   * Fetch the chunk.
   * @returns {Promise<MapServices>} Services.
   */
  loader: () => loadChunk('map'),
  notLoadedMessage: 'The map chunk is not loaded yet.',
});
