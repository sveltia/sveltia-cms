import { beforeEach, describe, expect, test, vi } from 'vitest';

import { searchLocations } from '$lib/services/contents/fields/map/geocoding';
import { sendRequest } from '$lib/services/utils/networking';

vi.mock('$lib/services/utils/networking', () => ({ sendRequest: vi.fn() }));

const sendRequestMock = vi.mocked(sendRequest);

describe('searchLocations()', () => {
  beforeEach(() => {
    sendRequestMock.mockReset();
  });

  test('returns nothing for a blank query without a request', async () => {
    expect(await searchLocations('   ')).toEqual([]);
    expect(sendRequestMock).not.toHaveBeenCalled();
  });

  test('queries the Nominatim API with the trimmed query', async () => {
    const results = [{ place_id: '1', display_name: 'Tokyo', lat: '35.6', lon: '139.7' }];

    sendRequestMock.mockResolvedValue(results);

    expect(await searchLocations('  Tokyo, Japan ')).toBe(results);
    expect(sendRequestMock).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search?q=Tokyo%2C+Japan&format=jsonv2',
    );
  });

  test('returns nothing when the request has failed', async () => {
    sendRequestMock.mockRejectedValue(new Error('Offline'));

    expect(await searchLocations('Tokyo')).toEqual([]);
  });
});
