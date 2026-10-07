import { describe, expect, test } from 'vitest';

import {
  assertOutsideCmsFolders,
  isCmsFolderName,
  isCmsFolderPath,
  isInCmsFolder,
} from '$lib/services/assets/reserved';

describe('assets/reserved', () => {
  test('tells the names of the folders the CMS is usually served from', () => {
    expect(isCmsFolderName('admin')).toBe(true);
    expect(isCmsFolderName('CMS')).toBe(true);
    expect(isCmsFolderName('admins')).toBe(false);
    expect(isCmsFolderName('images')).toBe(false);
  });

  test('tells a folder that is, or is below, such a folder', () => {
    expect(isCmsFolderPath('static/admin')).toBe(true);
    expect(isCmsFolderPath('static/admin/js')).toBe(true);
    expect(isCmsFolderPath('cms')).toBe(true);
    expect(isCmsFolderPath('static/images')).toBe(false);
    expect(isCmsFolderPath('')).toBe(false);
  });

  test('tells a file below such a folder, but not one merely named like it', () => {
    expect(isInCmsFolder('static/admin/index.html')).toBe(true);
    expect(isInCmsFolder('static/cms/js/app.js')).toBe(true);
    expect(isInCmsFolder('static/admin.png')).toBe(false);
    expect(isInCmsFolder('static/images/cms')).toBe(false);
    expect(isInCmsFolder('admin')).toBe(false);
  });

  test('refuses a change to a file below such a folder', () => {
    expect(() => assertOutsideCmsFolders(['static/images/a.png'])).not.toThrow();
    expect(() =>
      assertOutsideCmsFolders(['static/images/a.png', 'static/admin/index.html']),
    ).toThrow('Cannot change a file in a folder the CMS is served from');
  });
});
