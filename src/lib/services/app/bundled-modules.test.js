import { describe, expect, it } from 'vitest';

import { BUNDLED_MARKER_ICON_URL, BUNDLED_MODULE_LOADERS } from './bundled-modules';

describe('bundled modules', () => {
  it('bundles nothing outside the npm build, which loads the libraries from UNPKG', () => {
    expect(BUNDLED_MODULE_LOADERS).toEqual({});
    expect(BUNDLED_MARKER_ICON_URL).toBeUndefined();
  });
});
