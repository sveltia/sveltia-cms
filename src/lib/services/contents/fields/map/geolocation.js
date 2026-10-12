/**
 * @import { GeoCoordinates } from '$lib/types/private';
 */

/**
 * Error thrown when the browser doesn’t support the Geolocation API.
 */
export class GeolocationUnsupportedError extends Error {
  /**
   * Create an error.
   */
  constructor() {
    super('Geolocation is not supported');
    this.name = 'GeolocationUnsupportedError';
  }
}

/**
 * Get the current location of the user with the browser’s Geolocation API.
 * @returns {Promise<GeoCoordinates>} Coordinates. The promise is rejected with a
 * {@link GeolocationUnsupportedError} if the browser doesn’t support geolocation, or with the
 * `GeolocationPositionError` if the location can’t be determined, e.g. because the user has denied
 * the permission.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
 */
export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationUnsupportedError());

      return;
    }

    navigator.geolocation.getCurrentPosition(({ coords: { latitude, longitude } }) => {
      resolve({ latitude, longitude });
    }, reject);
  });
