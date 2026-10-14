/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { preloadReactDom } from '$lib/services/api/react-dom';

// @ts-ignore
global.window = { location: /** @type {Location} */ ({ href: 'https://sveltia.dev/admin/' }) };

vi.mock('$lib/services/api/react-dom', () => ({
  preloadReactDom: vi.fn(),
}));

const { customPageRegistry } = await import('$lib/services/api/registries');
const { registerCustomPage } = await import('$lib/services/api/methods/register-custom-page');

describe('CMS.registerCustomPage()', () => {
  const Component = () => null;

  beforeEach(() => {
    customPageRegistry.clear();
  });

  test('registers a page rendered with a React component', () => {
    registerCustomPage({
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      component: Component,
    });

    expect(customPageRegistry.get('analytics')).toEqual({
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      component: Component,
      url: undefined,
      newTab: false,
    });
    // The page renders with `react-dom`, so the library starts loading right away
    expect(preloadReactDom).toHaveBeenCalledTimes(1);
  });

  test('registers a page embedding a web page, with the default icon', () => {
    registerCustomPage({ id: 'docs_v2', label: 'Docs', url: 'https://example.com/docs' });

    expect(customPageRegistry.get('docs_v2')).toEqual({
      id: 'docs_v2',
      label: 'Docs',
      icon: 'extension',
      component: undefined,
      url: 'https://example.com/docs',
      newTab: false,
    });
    expect(preloadReactDom).not.toHaveBeenCalled();
  });

  test('resolves a relative URL against the current page URL', () => {
    registerCustomPage({ id: 'stats', label: 'Stats', url: '../stats/' });
    registerCustomPage({ id: 'help', label: 'Help', url: 'help.html', newTab: true });

    expect(customPageRegistry.get('stats')?.url).toBe('https://sveltia.dev/stats/');
    expect(customPageRegistry.get('help')).toMatchObject({
      url: 'https://sveltia.dev/admin/help.html',
      newTab: true,
    });
  });

  test('replaces a page registered with the same ID in place', () => {
    registerCustomPage({ id: 'a', label: 'A', url: '/a' });
    registerCustomPage({ id: 'b', label: 'B', url: '/b' });
    registerCustomPage({ id: 'a', label: 'New A', component: Component });

    expect([...customPageRegistry.keys()]).toEqual(['a', 'b']);
    expect(customPageRegistry.get('a')).toMatchObject({ label: 'New A', component: Component });
  });

  test('throws TypeError if the definition is not an object', () => {
    // @ts-ignore
    expect(() => registerCustomPage()).toThrow(
      'The `definition` option for `CMS.registerCustomPage()` must be an object',
    );
    // @ts-ignore
    expect(() => registerCustomPage('analytics')).toThrow(TypeError);
  });

  test.each([undefined, 123, '', 'a b', 'a/b', 'café', '../x'])(
    'throws TypeError for the invalid ID %j',
    (id) => {
      // @ts-ignore
      expect(() => registerCustomPage({ id, label: 'A', url: '/a' })).toThrow(
        'The `definition.id` must be a non-empty string of alphanumeric characters, hyphens and ' +
          'underscores',
      );
    },
  );

  test('throws TypeError if the label is not a non-empty string', () => {
    // @ts-ignore
    expect(() => registerCustomPage({ id: 'a', url: '/a' })).toThrow(
      'The `definition.label` must be a non-empty string',
    );
    expect(() => registerCustomPage({ id: 'a', label: ' ', url: '/a' })).toThrow(TypeError);
  });

  test('throws TypeError if the icon is given but not a non-empty string', () => {
    expect(() => registerCustomPage({ id: 'a', label: 'A', icon: '', url: '/a' })).toThrow(
      'The `definition.icon` must be a non-empty string',
    );
  });

  test('throws TypeError if neither or both of the component and URL are given', () => {
    const message = 'Either `definition.component` or `definition.url` must be given';

    // @ts-ignore
    expect(() => registerCustomPage({ id: 'a', label: 'A' })).toThrow(message);
    expect(() =>
      // @ts-ignore
      registerCustomPage({ id: 'a', label: 'A', component: Component, url: '/a' }),
    ).toThrow(message);
  });

  test('throws TypeError if the component is not a React component', () => {
    // @ts-ignore
    expect(() => registerCustomPage({ id: 'a', label: 'A', component: {} })).toThrow(
      'The `definition.component` must be a React component',
    );
  });

  test('throws TypeError if newTab is not a boolean or is given with a component', () => {
    const message = 'The `definition.newTab` must be a boolean given along with `url`';

    // @ts-ignore
    expect(() => registerCustomPage({ id: 'a', label: 'A', url: '/a', newTab: 1 })).toThrow(
      message,
    );
    expect(() =>
      // @ts-ignore
      registerCustomPage({ id: 'a', label: 'A', component: Component, newTab: false }),
    ).toThrow(message);
  });

  // eslint-disable-next-line no-script-url
  test.each(['', 123, 'http://', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.c'])(
    'throws TypeError for the invalid URL %j',
    (url) => {
      // @ts-ignore
      expect(() => registerCustomPage({ id: 'a', label: 'A', url })).toThrow(
        'The `definition.url` must be a valid `http` or `https` URL or file path',
      );
    },
  );

  test('leaves the registry untouched when the definition is invalid', () => {
    // @ts-ignore
    expect(() => registerCustomPage({ id: 'a', label: 'A', url: 'mailto:a@b.c' })).toThrow();
    expect(customPageRegistry.size).toBe(0);
  });
});
