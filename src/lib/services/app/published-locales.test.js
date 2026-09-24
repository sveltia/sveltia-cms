import { describe, expect, it } from 'vitest';

import { PUBLISHED_LOCALE_LOADERS } from './published-locales';

describe('PUBLISHED_LOCALE_LOADERS', () => {
  it('is empty outside the npm build, which generates the loaders', () => {
    expect(PUBLISHED_LOCALE_LOADERS).toEqual({});
  });
});
