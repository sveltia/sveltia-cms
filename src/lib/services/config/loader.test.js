// @ts-nocheck - Disable TypeScript checking for test file due to complex mocking
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-description, jsdoc/require-returns */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchFile, fetchSiteConfig, getConfigPath } from './loader';

// Mock dependencies
global.fetch = vi.fn();
global.document = {
  querySelectorAll: vi.fn(),
};
global.window = {
  location: {
    pathname: '/admin/',
  },
};

describe('config/loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfigPath', () => {
    test('should append config.yml if path ends with a slash', () => {
      expect(getConfigPath('/admin/')).toBe('/admin/config.yml');
      expect(getConfigPath('/admin/cms/')).toBe('/admin/cms/config.yml');
      expect(getConfigPath('/')).toBe('/config.yml');
    });

    test('should replace file with config.yml if path ends with a file', () => {
      expect(getConfigPath('/admin/index.html')).toBe('/admin/config.yml');
      expect(getConfigPath('/admin/cms.php')).toBe('/admin/config.yml');
      expect(getConfigPath('/admin/app.js')).toBe('/admin/config.yml');
    });

    test('should append config.yml if path does not end with a slash or file', () => {
      expect(getConfigPath('/admin')).toBe('/admin/config.yml');
      expect(getConfigPath('/admin/cms')).toBe('/admin/cms/config.yml');
      expect(getConfigPath('/nested/path')).toBe('/nested/path/config.yml');
    });

    test('should handle edge cases', () => {
      expect(getConfigPath('')).toBe('/config.yml');
      expect(getConfigPath('/admin/file.name.ext')).toBe('/admin/config.yml');
      expect(getConfigPath('/admin/no-extension')).toBe('/admin/no-extension/config.yml');
    });
  });

  describe('fetchSiteConfig', () => {
    test('should fetch config from default path when no link elements', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('collections:\n  - name: posts'),
      });

      const result = await fetchSiteConfig();

      expect(fetch).toHaveBeenCalledWith('/admin/config.yml');
      expect(result).toEqual({ collections: [{ name: 'posts' }] });
    });

    test('should fetch config from link elements', async () => {
      const mockLinks = [{ href: 'custom-config.yml', type: 'application/yaml' }];

      document.querySelectorAll.mockReturnValue(mockLinks);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('backend:\n  name: github'),
      });

      const result = await fetchSiteConfig();

      expect(fetch).toHaveBeenCalledWith('custom-config.yml');
      expect(result).toEqual({ backend: { name: 'github' } });
    });

    test('should merge multiple config files', async () => {
      const mockLinks = [
        { href: 'base-config.yml', type: 'application/yaml' },
        { href: 'override-config.yml', type: 'application/yaml' },
      ];

      document.querySelectorAll.mockReturnValue(mockLinks);

      fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          /**
           *
           */
          text: () => Promise.resolve('backend:\n  name: github\ncollections:\n  - name: posts'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          /**
           *
           */
          text: () => Promise.resolve('media_folder: static/images\ncollections:\n  - name: pages'),
        });

      const result = await fetchSiteConfig();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        backend: { name: 'github' },
        media_folder: 'static/images',
        collections: [{ name: 'posts' }, { name: 'pages' }],
      });
    });

    test('should handle JSON config files', async () => {
      const mockLinks = [{ href: 'config.json', type: 'application/json' }];

      document.querySelectorAll.mockReturnValue(mockLinks);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ backend: { name: 'gitlab' } }),
      });

      const result = await fetchSiteConfig();

      expect(result).toEqual({ backend: { name: 'gitlab' } });
    });

    test('should throw error for unsupported file type', async () => {
      const mockLinks = [{ href: 'config.xml', type: 'application/xml' }];

      document.querySelectorAll.mockReturnValue(mockLinks);

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should throw error for fetch failure', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should throw error for non-ok response', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should throw error for invalid YAML', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid: yaml: content:'),
      });

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should throw error for invalid JSON', async () => {
      const mockLinks = [{ href: 'config.json', type: 'application/json' }];

      document.querySelectorAll.mockReturnValue(mockLinks);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should throw error for non-object result', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('- item1\n- item2'),
      });

      await expect(fetchSiteConfig()).rejects.toThrow();
    });

    test('should handle default file type', async () => {
      const mockLinks = [
        { href: 'config.yml' }, // no type specified
      ];

      document.querySelectorAll.mockReturnValue(mockLinks);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('backend:\n  name: github'),
      });

      const result = await fetchSiteConfig();

      expect(result).toEqual({ backend: { name: 'github' } });
    });

    test('should handle YAML merge feature', async () => {
      document.querySelectorAll.mockReturnValue([]);

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(`
defaults: &defaults
  media_folder: static/images

backend:
  <<: *defaults
  name: github
`),
      });

      const result = await fetchSiteConfig();

      expect(result.backend.media_folder).toBe('static/images');
      expect(result.backend.name).toBe('github');
    });
  });

  describe('fetchFile', () => {
    test('should fetch and parse YAML file', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('backend:\n  name: github\ncollections:\n  - name: posts'),
      });

      const result = await fetchFile({ href: '/config.yml', type: 'application/yaml' });

      expect(fetch).toHaveBeenCalledWith('/config.yml');
      expect(result).toEqual({ backend: { name: 'github' }, collections: [{ name: 'posts' }] });
    });

    test('should fetch and parse JSON file', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ backend: { name: 'gitlab' }, media_folder: 'static' }),
      });

      const result = await fetchFile({ href: '/config.json', type: 'application/json' });

      expect(fetch).toHaveBeenCalledWith('/config.json');
      expect(result).toEqual({ backend: { name: 'gitlab' }, media_folder: 'static' });
    });

    test('should use default type application/yaml', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('test: value'),
      });

      const result = await fetchFile({ href: '/config.yml' });

      expect(result).toEqual({ test: 'value' });
    });

    test('should handle text/yaml type', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('backend:\n  name: gitea'),
      });

      const result = await fetchFile({ href: '/config.yml', type: 'text/yaml' });

      expect(result).toEqual({ backend: { name: 'gitea' } });
    });

    test('should throw error for unsupported file type', async () => {
      await expect(fetchFile({ href: '/config.xml', type: 'application/xml' })).rejects.toThrow();
    });

    test('should throw error when fetch fails', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchFile({ href: '/config.yml' })).rejects.toThrow();
    });

    test('should throw error for non-ok response', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fetchFile({ href: '/config.yml' })).rejects.toThrow();
    });

    test('should throw error for invalid YAML', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid: yaml: [content'),
      });

      await expect(fetchFile({ href: '/config.yml' })).rejects.toThrow();
    });

    test('should throw error for invalid JSON', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(fetchFile({ href: '/config.json', type: 'application/json' })).rejects.toThrow();
    });

    test('should throw error for non-object result', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('- item1\n- item2'),
      });

      await expect(fetchFile({ href: '/config.yml' })).rejects.toThrow();
    });

    test('should throw error for null result', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('null'),
      });

      await expect(fetchFile({ href: '/config.yml' })).rejects.toThrow();
    });

    test('should handle complex nested YAML', async () => {
      const complexYaml = `
backend:
  name: github
  repo: test/repo
collections:
  - name: posts
    folder: content/posts
    fields:
      - { name: title, widget: string }
      - { name: body, widget: markdown }
`;

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(complexYaml),
      });

      const result = await fetchFile({ href: '/config.yml' });

      expect(result).toEqual({
        backend: { name: 'github', repo: 'test/repo' },
        collections: [
          {
            name: 'posts',
            folder: 'content/posts',
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'body', widget: 'markdown' },
            ],
          },
        ],
      });
    });
  });
});
