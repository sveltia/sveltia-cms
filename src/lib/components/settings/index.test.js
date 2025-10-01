import { get } from 'svelte/store';
import { describe, expect, test } from 'vitest';

import { siteConfig } from '$lib/services/config';

import { panels } from './index.js';

describe('Settings panels', () => {
  test('should export panels store', () => {
    expect(panels).toBeDefined();
  });

  test('should have appearance panel', () => {
    const panelList = get(panels);
    const appearancePanel = panelList.find((panel) => panel.key === 'appearance');

    expect(appearancePanel).toBeDefined();
    expect(appearancePanel?.icon).toBe('palette');
    expect(appearancePanel?.component).toBeDefined();
  });

  test('should have language panel', () => {
    const panelList = get(panels);
    const languagePanel = panelList.find((panel) => panel.key === 'language');

    expect(languagePanel).toBeDefined();
    expect(languagePanel?.icon).toBe('language');
    expect(languagePanel?.component).toBeDefined();
  });

  test('should have contents panel', () => {
    const panelList = get(panels);
    const contentsPanel = panelList.find((panel) => panel.key === 'contents');

    expect(contentsPanel).toBeDefined();
    expect(contentsPanel?.icon).toBe('library_books');
    expect(contentsPanel?.component).toBeDefined();
  });

  test('should have i18n panel', () => {
    const panelList = get(panels);
    const i18nPanel = panelList.find((panel) => panel.key === 'i18n');

    expect(i18nPanel).toBeDefined();
    expect(i18nPanel?.icon).toBe('translate');
    expect(i18nPanel?.component).toBeDefined();
  });

  test('should have media panel', () => {
    const panelList = get(panels);
    const mediaPanel = panelList.find((panel) => panel.key === 'media');

    expect(mediaPanel).toBeDefined();
    expect(mediaPanel?.icon).toBe('photo_library');
    expect(mediaPanel?.component).toBeDefined();
  });

  test('should have accessibility panel', () => {
    const panelList = get(panels);
    const accessibilityPanel = panelList.find((panel) => panel.key === 'accessibility');

    expect(accessibilityPanel).toBeDefined();
    expect(accessibilityPanel?.icon).toBe('accessibility_new');
    expect(accessibilityPanel?.component).toBeDefined();
  });

  test('should have advanced panel', () => {
    const panelList = get(panels);
    const advancedPanel = panelList.find((panel) => panel.key === 'advanced');

    expect(advancedPanel).toBeDefined();
    expect(advancedPanel?.icon).toBe('build');
    expect(advancedPanel?.component).toBeDefined();
  });

  test('should enable i18n panel when multiple locales configured', () => {
    siteConfig.set({
      backend: { name: 'github', repo: 'test/test' },
      media_folder: 'static/images',
      collections: [],
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'fr', 'de'],
        default_locale: 'en',
      },
      _siteURL: 'http://localhost',
      _baseURL: 'http://localhost',
    });

    const panelList = get(panels);
    const i18nPanel = panelList.find((panel) => panel.key === 'i18n');

    expect(i18nPanel?.enabled).toBe(true);
  });

  test('should disable i18n panel when single locale configured', () => {
    siteConfig.set({
      backend: { name: 'github', repo: 'test/test' },
      media_folder: 'static/images',
      collections: [],
      i18n: {
        structure: 'multiple_files',
        locales: ['en'],
        default_locale: 'en',
      },
      _siteURL: 'http://localhost',
      _baseURL: 'http://localhost',
    });

    const panelList = get(panels);
    const i18nPanel = panelList.find((panel) => panel.key === 'i18n');

    expect(i18nPanel?.enabled).toBe(false);
  });

  test('should disable i18n panel when no locales configured', () => {
    siteConfig.set({
      backend: { name: 'github', repo: 'test/test' },
      media_folder: 'static/images',
      collections: [],
      _siteURL: 'http://localhost',
      _baseURL: 'http://localhost',
    });

    const panelList = get(panels);
    const i18nPanel = panelList.find((panel) => panel.key === 'i18n');

    expect(i18nPanel?.enabled).toBe(false);
  });
});
