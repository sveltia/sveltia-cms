import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAllStatusLabels,
  getKnownLabelPrefixes,
  getLabelPrefix,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';

vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('svelte/store', () => ({ get: vi.fn() }));

describe('workflow/labels', () => {
  beforeEach(() => {
    vi.mocked(get).mockReturnValue({ backend: { name: 'github' } });
  });

  describe('getLabelPrefix', () => {
    test('returns the default prefix', () => {
      expect(getLabelPrefix()).toBe('sveltia-cms/');
    });

    test('returns the configured prefix', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });
      expect(getLabelPrefix()).toBe('cms/');
    });

    test('falls back to the default prefix when the option is an empty string', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: '' } });
      expect(getLabelPrefix()).toBe('sveltia-cms/');
    });

    test('falls back to the default prefix when the config is not loaded', () => {
      vi.mocked(get).mockReturnValue(undefined);
      expect(getLabelPrefix()).toBe('sveltia-cms/');
    });
  });

  describe('getKnownLabelPrefixes', () => {
    test('includes the Netlify/Decap CMS prefixes, without duplicating the default', () => {
      expect(getKnownLabelPrefixes()).toEqual(['sveltia-cms/', 'netlify-cms/', 'decap-cms/']);
    });

    test('puts a custom prefix first, keeping the default', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });

      expect(getKnownLabelPrefixes()).toEqual([
        'cms/',
        'sveltia-cms/',
        'netlify-cms/',
        'decap-cms/',
      ]);
    });
  });

  describe('getStatusLabel', () => {
    test('prefixes the status', () => {
      expect(getStatusLabel('draft')).toBe('sveltia-cms/draft');
      expect(getStatusLabel('pending_review')).toBe('sveltia-cms/pending_review');
      expect(getStatusLabel('pending_publish')).toBe('sveltia-cms/pending_publish');
    });

    test('always writes with the configured prefix', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });
      expect(getStatusLabel('draft')).toBe('cms/draft');
    });
  });

  describe('getAllStatusLabels', () => {
    test('returns the labels for every known prefix', () => {
      expect(getAllStatusLabels()).toEqual([
        'sveltia-cms/draft',
        'sveltia-cms/pending_review',
        'sveltia-cms/pending_publish',
        'netlify-cms/draft',
        'netlify-cms/pending_review',
        'netlify-cms/pending_publish',
        'decap-cms/draft',
        'decap-cms/pending_review',
        'decap-cms/pending_publish',
      ]);
    });

    test('includes a custom prefix', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });
      expect(getAllStatusLabels()).toContain('cms/draft');
      expect(getAllStatusLabels()).toContain('sveltia-cms/draft');
    });
  });

  describe('getStatusFromLabels', () => {
    test('finds the status', () => {
      expect(getStatusFromLabels(['bug', 'sveltia-cms/pending_review'])).toBe('pending_review');
    });

    test('returns undefined when no CMS label is found', () => {
      expect(getStatusFromLabels(['bug'])).toBeUndefined();
      expect(getStatusFromLabels([])).toBeUndefined();
    });

    test('recognizes the Netlify/Decap CMS labels', () => {
      expect(getStatusFromLabels(['netlify-cms/draft'])).toBe('draft');
      expect(getStatusFromLabels(['decap-cms/pending_publish'])).toBe('pending_publish');
    });

    test('recognizes a custom prefix as well as the known ones', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });
      expect(getStatusFromLabels(['cms/draft'])).toBe('draft');
      expect(getStatusFromLabels(['sveltia-cms/draft'])).toBe('draft');
      expect(getStatusFromLabels(['decap-cms/draft'])).toBe('draft');
    });

    test('gives precedence to the configured prefix', () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', cms_label_prefix: 'cms/' } });

      expect(getStatusFromLabels(['decap-cms/draft', 'cms/pending_publish'])).toBe(
        'pending_publish',
      );
    });
  });
});
