import dayjsLocales from 'dayjs/locale.json';
import { describe, expect, test } from 'vitest';

import { loadLocaleData } from '$lib/services/contents/fields/date-time/locale-loader.npm';

describe('loadLocaleData() in the npm build', () => {
  // Every locale `getDayjsLocaleKey()` can return has to be bundled
  test.each(dayjsLocales.map(({ key }) => key))('loads the bundled %s locale', async (key) => {
    await expect(loadLocaleData(key)).resolves.toMatchObject({ name: key });
  });
});
