import { afterEach, describe, expect, test, vi } from 'vitest';

import { GeolocationUnsupportedError, getCurrentPosition } from './geolocation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCurrentPosition()', () => {
  test('resolves with the coordinates', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({ coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 } });
        }),
      },
    });

    await expect(getCurrentPosition()).resolves.toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  test('rejects with the error of the API', async () => {
    const error = { code: 1, message: 'Denied' };

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_success, failure) => {
          failure(error);
        }),
      },
    });

    await expect(getCurrentPosition()).rejects.toBe(error);
  });

  test('rejects when geolocation is not supported', async () => {
    vi.stubGlobal('navigator', {});

    const promise = getCurrentPosition();

    await expect(promise).rejects.toBeInstanceOf(GeolocationUnsupportedError);
    await expect(promise).rejects.toThrow('Geolocation is not supported');
  });
});
