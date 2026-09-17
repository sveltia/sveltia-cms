import { describe, expect, test } from 'vitest';

import { getPublishMode, isWorkflowConfigured } from '$lib/services/workflow/config';

/** @type {any} */
const posts = { name: 'posts', folder: 'content/posts', fields: [] };
/** @type {any} */
const settings = { name: 'settings', files: [], publish_mode: 'simple' };

/** @type {any} */
const reviewed = {
  name: 'reviewed',
  folder: 'content/reviewed',
  publish_mode: 'editorial_workflow',
};

/** @type {any} */
const divider = { divider: true };

describe('workflow/config', () => {
  describe('getPublishMode', () => {
    test('defaults to simple', () => {
      expect(getPublishMode({ cmsConfig: undefined })).toBe('simple');
      expect(getPublishMode({ cmsConfig: /** @type {any} */ ({}) })).toBe('simple');
      expect(getPublishMode({ cmsConfig: /** @type {any} */ ({}), collection: posts })).toBe(
        'simple',
      );
    });

    test('treats an empty site-level option as simple', () => {
      expect(getPublishMode({ cmsConfig: /** @type {any} */ ({ publish_mode: '' }) })).toBe(
        'simple',
      );
    });

    test('falls back to the site-level option', () => {
      const cmsConfig = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });

      expect(getPublishMode({ cmsConfig })).toBe('editorial_workflow');
      expect(getPublishMode({ cmsConfig, collection: posts })).toBe('editorial_workflow');
    });

    test('lets a collection override the site-level option either way', () => {
      expect(
        getPublishMode({
          cmsConfig: /** @type {any} */ ({ publish_mode: 'editorial_workflow' }),
          collection: settings,
        }),
      ).toBe('simple');
      expect(
        getPublishMode({
          cmsConfig: /** @type {any} */ ({ publish_mode: 'simple' }),
          collection: reviewed,
        }),
      ).toBe('editorial_workflow');
      expect(getPublishMode({ cmsConfig: /** @type {any} */ ({}), collection: reviewed })).toBe(
        'editorial_workflow',
      );
    });
  });

  describe('isWorkflowConfigured', () => {
    test('is false without any editorial_workflow publish mode', () => {
      expect(isWorkflowConfigured(undefined)).toBe(false);
      expect(isWorkflowConfigured(/** @type {any} */ ({}))).toBe(false);
      expect(
        isWorkflowConfigured(
          /** @type {any} */ ({ publish_mode: 'simple', collections: [posts, settings, divider] }),
        ),
      ).toBe(false);
    });

    test('is true with the site-level option, whatever the collections say', () => {
      expect(
        isWorkflowConfigured(
          /** @type {any} */ ({ publish_mode: 'editorial_workflow', collections: [settings] }),
        ),
      ).toBe(true);
      // Singletons follow the site-level option, so no collection is needed
      expect(
        isWorkflowConfigured(/** @type {any} */ ({ publish_mode: 'editorial_workflow' })),
      ).toBe(true);
    });

    test('copes with collections that aren’t a list', () => {
      // The parser sees the raw configuration, which the schema validation reports separately
      expect(isWorkflowConfigured(/** @type {any} */ ({ collections: {} }))).toBe(false);
      expect(isWorkflowConfigured(/** @type {any} */ ({ collections: 'posts' }))).toBe(false);
    });

    test('is true when a collection opts in on its own', () => {
      expect(
        isWorkflowConfigured(/** @type {any} */ ({ collections: [divider, posts, reviewed] })),
      ).toBe(true);
    });
  });
});
