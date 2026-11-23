/**
 * Entry point of the `map` chunk, built separately from the main bundle and loaded on demand, as
 * only a site with a Map field needs it. The modules it shares with the rest of the app come from
 * the main bundle, see `shareMainModules()` in `scripts/vite/chunks.js`.
 */
export { createMapDrawController } from '$lib/services/contents/fields/map/draw';
export { searchLocations } from '$lib/services/contents/fields/map/geocoding';
export {
  GeolocationUnsupportedError,
  getCurrentPosition,
} from '$lib/services/contents/fields/map/geolocation';
export { isValidGeoJSON, parseGeoJSON } from '$lib/services/contents/fields/map/helpers';
