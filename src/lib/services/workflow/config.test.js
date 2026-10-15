import { describe, expect, test } from 'vitest';

import {
  getPublishMode,
  getPublishModeOptions,
  isWorkflowConfigured,
  isWorkflowMode,
} from '$lib/services/workflow/config';

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

  describe('getPublishModeOptions', () => {
    test('fills in the defaults', () => {
      expect(getPublishModeOptions({ cmsConfig: undefined })).toEqual({
        type: 'simple',
        stages: ['draft', 'pending_review', 'pending_publish'],
        directPublish: false,
        allowIncompleteDrafts: true,
      });
    });

    test('reads the object form', () => {
      expect(
        getPublishModeOptions({
          cmsConfig: /** @type {any} */ ({
            publish_mode: {
              type: 'editorial_workflow',
              stages: ['draft', 'pending_publish'],
              direct_publish: true,
              allow_incomplete_drafts: false,
            },
          }),
        }),
      ).toEqual({
        type: 'editorial_workflow',
        stages: ['draft', 'pending_publish'],
        directPublish: true,
        allowIncompleteDrafts: false,
      });
    });

    test('gives Preview Workflow the drafting stage only', () => {
      expect(
        getPublishModeOptions({
          cmsConfig: /** @type {any} */ ({
            publish_mode: { type: 'preview', stages: ['draft', 'pending_review'] },
          }),
        }).stages,
      ).toEqual(['draft']);
    });

    test('keeps the stages in order with the drafting stage, dropping unknown ones', () => {
      expect(
        getPublishModeOptions({
          cmsConfig: /** @type {any} */ ({
            publish_mode: { type: 'editorial_workflow', stages: ['pending_publish', 'foo'] },
          }),
        }).stages,
      ).toEqual(['draft', 'pending_publish']);
    });

    test('ignores direct publishing with the simple publish mode', () => {
      expect(
        getPublishModeOptions({
          cmsConfig: /** @type {any} */ ({ publish_mode: { direct_publish: true } }),
        }).directPublish,
      ).toBe(false);
    });

    test('treats an unknown publish mode or option value as simple', () => {
      expect(
        getPublishModeOptions({ cmsConfig: /** @type {any} */ ({ publish_mode: 'unknown' }) }).type,
      ).toBe('simple');
      expect(
        getPublishModeOptions({ cmsConfig: /** @type {any} */ ({ publish_mode: 1 }) }).type,
      ).toBe('simple');
    });

    test('lets a collection override the site-level options one by one', () => {
      const cmsConfig = /** @type {any} */ ({
        publish_mode: { type: 'editorial_workflow', direct_publish: true },
      });

      expect(
        getPublishModeOptions({
          cmsConfig,
          collection: /** @type {any} */ ({ name: 'posts', publish_mode: { stages: ['draft'] } }),
        }),
      ).toMatchObject({ type: 'editorial_workflow', stages: ['draft'], directPublish: true });
      expect(
        getPublishModeOptions({
          cmsConfig,
          collection: /** @type {any} */ ({ name: 'posts', publish_mode: 'preview' }),
        }),
      ).toMatchObject({ type: 'preview', directPublish: true });
    });
  });

  describe('isWorkflowMode', () => {
    test('tells the publish modes that use pull requests', () => {
      expect(isWorkflowMode('simple')).toBe(false);
      expect(isWorkflowMode('preview')).toBe(true);
      expect(isWorkflowMode('editorial_workflow')).toBe(true);
    });
  });

  describe('isWorkflowConfigured', () => {
    test('counts Preview Workflow', () => {
      expect(isWorkflowConfigured(/** @type {any} */ ({ publish_mode: 'preview' }))).toBe(true);
      expect(
        isWorkflowConfigured(
          /** @type {any} */ ({ collections: [{ name: 'a', publish_mode: { type: 'preview' } }] }),
        ),
      ).toBe(true);
    });

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
