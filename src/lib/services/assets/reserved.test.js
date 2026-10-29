import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  assertOutsideCmsFolders,
  isCmsFolderName,
  isCmsFolderPath,
  isInCmsFolder,
} from '$lib/services/assets/reserved';
import { cmsConfig } from '$lib/services/config/state';

describe('assets/reserved', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
    vi.unstubAllGlobals();
  });

  /**
   * Set the global media and public folders.
   * @param {string | undefined} mediaFolder `media_folder` option.
   * @param {string | undefined} publicFolder `public_folder` option.
   */
  const setFolders = (mediaFolder, publicFolder) => {
    cmsConfig.current = /** @type {any} */ ({
      media_folder: mediaFolder,
      public_folder: publicFolder,
    });
  };

  test('tells the names of the folders the CMS is usually served from', () => {
    expect(isCmsFolderName('admin')).toBe(true);
    expect(isCmsFolderName('CMS')).toBe(true);
    expect(isCmsFolderName('admins')).toBe(false);
    expect(isCmsFolderName('images')).toBe(false);
  });

  test('tells a folder that is, or is below, such a folder', () => {
    expect(isCmsFolderPath('static/admin')).toBe(true);
    expect(isCmsFolderPath('static/admin/js')).toBe(true);
    expect(isCmsFolderPath('public/CMS')).toBe(true);
    expect(isCmsFolderPath('cms')).toBe(true);
    expect(isCmsFolderPath('admin/')).toBe(true);
    expect(isCmsFolderPath('static/images')).toBe(false);
    expect(isCmsFolderPath('static/administration')).toBe(false);
    expect(isCmsFolderPath('')).toBe(false);
  });

  test('doesn’t take a folder named like it deeper down for such a folder', () => {
    // A Hugo page bundle with the `cms` slug
    expect(isCmsFolderPath('content/posts/cms')).toBe(false);
    expect(isInCmsFolder('content/posts/cms/cover.jpg')).toBe(false);
    // A Starlight docs page
    expect(isInCmsFolder('src/content/docs/admin/index.md')).toBe(false);
  });

  test('tells such a folder below the folder the site is served from', () => {
    setFolders('docs/public/images', '/images');
    expect(isInCmsFolder('docs/public/admin/index.html')).toBe(true);
    expect(isInCmsFolder('docs/admin/logo.png')).toBe(false);

    setFolders('/src/assets/', 'assets');
    expect(isInCmsFolder('src/admin/config.yml')).toBe(true);

    setFolders('./site', '/');
    expect(isInCmsFolder('site/cms/index.html')).toBe(true);

    setFolders('images', '/images');
    expect(isInCmsFolder('admin/index.html')).toBe(true);
    expect(isInCmsFolder('images/admin/a.png')).toBe(false);
  });

  test('ignores the global folders that don’t tell where the site is served from', () => {
    [
      ['src/images', '/media'],
      ['src/assets/images', '@assets/images'],
      ['src/images', '../images'],
      ['src/{{locale}}/images', '/images'],
      ['src/images', undefined],
      [undefined, '/images'],
    ].forEach(([mediaFolder, publicFolder]) => {
      setFolders(mediaFolder, publicFolder);
      expect(isInCmsFolder('src/admin/logo.png')).toBe(false);
      expect(isInCmsFolder('static/admin/index.html')).toBe(true);
    });
  });

  test('tells the folder of the admin page the CMS is running on', () => {
    vi.stubGlobal('location', { pathname: '/dashboard/' });
    expect(isInCmsFolder('dashboard/index.html')).toBe(true);
    expect(isInCmsFolder('static/dashboard/config.yml')).toBe(true);
    expect(isInCmsFolder('content/dashboard/index.md')).toBe(false);

    vi.stubGlobal('location', { pathname: '/site/My%20CMS/index.html' });
    expect(isInCmsFolder('public/site/my cms/index.html')).toBe(true);
    expect(isInCmsFolder('public/site/index.html')).toBe(false);

    // A site served below a base path, like a GitHub Pages project site
    vi.stubGlobal('location', { pathname: '/repo/dashboard/' });
    expect(isInCmsFolder('static/dashboard/index.html')).toBe(true);
    expect(isInCmsFolder('static/repo/dashboard/index.html')).toBe(true);
    expect(isInCmsFolder('static/repo/index.html')).toBe(false);

    // A page at the root doesn’t make the whole repository read-only
    vi.stubGlobal('location', { pathname: '/index.html' });
    expect(isInCmsFolder('index.html')).toBe(false);
    expect(isInCmsFolder('images/a.png')).toBe(false);

    // A path that can’t be decoded is ignored
    vi.stubGlobal('location', { pathname: '/%E0%A4%A/' });
    expect(isInCmsFolder('images/a.png')).toBe(false);
    expect(isInCmsFolder('admin/index.html')).toBe(true);
  });

  test('tells the admin page or its configuration file in a folder named like such a folder', () => {
    // The site root can’t be told from the configuration here, so the narrower check misses these
    setFolders('docs/assets', '/assets');
    expect(isInCmsFolder('docs/public/admin/index.html')).toBe(true);
    expect(isInCmsFolder('docs/public/admin/config.yml')).toBe(true);
    expect(isInCmsFolder('docs/.vuepress/public/CMS/Config.YAML')).toBe(true);
    expect(isInCmsFolder('website/static/admin/js/config.toml')).toBe(true);
    expect(isInCmsFolder('src/cms/config.json')).toBe(true);
    // Other files in such a folder deeper down, like a Hugo page bundle, are left editable
    expect(isInCmsFolder('docs/public/admin/logo.png')).toBe(false);
    expect(isInCmsFolder('content/posts/cms/cover.jpg')).toBe(false);
    expect(isInCmsFolder('content/posts/cms/index.md')).toBe(false);
    expect(isInCmsFolder('content/posts/cms/config.yml.bak')).toBe(false);
    // The same file names elsewhere are left editable as well
    expect(isInCmsFolder('docs/public/index.html')).toBe(false);
    expect(isInCmsFolder('config.yml')).toBe(false);
    expect(() => assertOutsideCmsFolders(['docs/public/admin/index.html'])).toThrow();
    expect(() => assertOutsideCmsFolders(['content/posts/cms/cover.jpg'])).not.toThrow();
  });

  test('tells the admin page or its configuration file in a folder named like the admin page’s', () => {
    vi.stubGlobal('location', { pathname: '/repo/dashboard/' });
    expect(isInCmsFolder('docs/public/dashboard/index.html')).toBe(true);
    expect(isInCmsFolder('docs/public/dashboard/logo.png')).toBe(false);
    // Only the folder of the page itself counts, not the base path
    expect(isInCmsFolder('docs/public/repo/index.html')).toBe(false);
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
