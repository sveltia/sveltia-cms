import { describe, expect, test, vi } from 'vitest';

import { loadModule } from '$lib/services/app/dependencies';
import { loadLocaleData } from '$lib/services/contents/fields/date-time/locale-loader';

vi.mock('$lib/services/app/dependencies', () => ({ loadModule: vi.fn() }));

describe('loadLocaleData()', () => {
  test('loads the ES module of the locale from UNPKG and returns its data', async () => {
    const data = { name: 'de' };

    vi.mocked(loadModule).mockResolvedValue({ default: data });

    await expect(loadLocaleData('de')).resolves.toBe(data);
    expect(loadModule).toHaveBeenCalledWith('dayjs', 'esm/locale/de.js');
  });
});
