import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
} from '$lib/services/api/registries';
import {
  buildPreviewFrameHTML,
  getPreviewTemplate,
  usesPreviewFrame,
} from '$lib/services/contents/editor/preview-frame';

afterEach(() => {
  customPreviewStyleRegistry.clear();
  customPreviewTemplateRegistry.clear();
});

describe('getPreviewTemplate()', () => {
  test('returns the template registered for the collection or file', () => {
    const postTemplate = vi.fn();
    const aboutTemplate = vi.fn();

    customPreviewTemplateRegistry.set('posts', postTemplate);
    customPreviewTemplateRegistry.set('about', aboutTemplate);

    expect(getPreviewTemplate({ collectionName: 'posts' })).toBe(postTemplate);
    expect(getPreviewTemplate({ collectionName: 'pages', fileName: 'about' })).toBe(aboutTemplate);
    expect(getPreviewTemplate({ collectionName: 'pages', fileName: 'contact' })).toBeUndefined();
    expect(getPreviewTemplate({ collectionName: 'pages' })).toBeUndefined();
  });
});

describe('usesPreviewFrame()', () => {
  test('returns false without a matching stylesheet or template', () => {
    expect(usesPreviewFrame({ collectionName: 'posts' })).toBe(false);

    customPreviewTemplateRegistry.set('pages', () => null);
    customPreviewStyleRegistry.add({ url: '/pages.css', collection: 'pages' });

    // A template or stylesheet for another collection doesn’t count
    expect(usesPreviewFrame({ collectionName: 'posts' })).toBe(false);
  });

  test('returns true with a matching template', () => {
    customPreviewTemplateRegistry.set('posts', () => null);

    expect(usesPreviewFrame({ collectionName: 'posts' })).toBe(true);
  });

  test('returns true with a matching stylesheet', () => {
    customPreviewStyleRegistry.add({ url: '/posts.css', collection: 'posts' });

    expect(usesPreviewFrame({ collectionName: 'posts' })).toBe(true);
  });
});

describe('buildPreviewFrameHTML()', () => {
  test('sets the language, direction, base URL and stylesheets', () => {
    const html = buildPreviewFrameHTML({
      lang: 'ar',
      dir: 'rtl',
      styleURLs: ['/a.css', '/b.css?x="1"'],
      origin: 'https://example.com',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('<base href="https://example.com" target="_blank">');
    expect(html).toContain(
      '<link rel="stylesheet" href="/a.css">\n<link rel="stylesheet" href="/b.css?x=&quot;1&quot;">',
    );
    expect(html).toContain('<body></body>');
  });

  test('leaves out the language and direction when not given', () => {
    const html = buildPreviewFrameHTML({ styleURLs: [], origin: 'http://localhost' });

    expect(html).toContain('<html>');
    expect(html).not.toContain('<link');
  });
});
