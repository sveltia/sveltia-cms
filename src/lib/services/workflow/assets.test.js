import { beforeEach, describe, expect, test } from 'vitest';

import { allAssets } from '$lib/services/assets';
import {
  mergeWorkflowAssets,
  publishWorkflowAssets,
  removeWorkflowAssets,
} from '$lib/services/workflow/assets';

const BRANCH = 'cms/posts/hello';
/**
 * Create a minimal asset for testing.
 * @param {string} path Asset path.
 * @param {object} [extra] Extra properties.
 * @returns {any} Asset.
 */
const createAsset = (path, extra = {}) => ({ path, name: path.split('/').pop(), ...extra });

describe('workflow/assets', () => {
  beforeEach(() => {
    allAssets.current = [];
  });

  describe('mergeWorkflowAssets', () => {
    test('does nothing for an empty list', () => {
      allAssets.current = [createAsset('static/a.png')];
      mergeWorkflowAssets([]);

      expect(allAssets.current).toEqual([createAsset('static/a.png')]);
    });

    test('appends a new asset', () => {
      allAssets.current = [createAsset('static/a.png')];
      mergeWorkflowAssets([createAsset('static/b.png', { workflow: { branch: BRANCH } })]);

      expect(allAssets.current.map(({ path }) => path)).toEqual(['static/a.png', 'static/b.png']);
      expect(allAssets.current[1].workflow).toEqual({ branch: BRANCH, replacedAsset: undefined });
    });

    test('shadows a published asset in place, keeping it aside', () => {
      const published = createAsset('static/a.png', { sha: 'old' });

      allAssets.current = [published, createAsset('static/b.png')];
      mergeWorkflowAssets([
        createAsset('static/a.png', { sha: 'new', workflow: { branch: BRANCH } }),
      ]);

      const [first, second] = allAssets.current;

      // The order is kept, so the asset doesn’t jump to the end of the media library
      expect(first.path).toBe('static/a.png');
      expect(second.path).toBe('static/b.png');
      expect(first.sha).toBe('new');
      expect(first.workflow?.replacedAsset).toBe(published);
    });

    test('keeps the original published asset when the draft is saved again', () => {
      const published = createAsset('static/a.png', { sha: 'old' });

      allAssets.current = [published];

      mergeWorkflowAssets([
        createAsset('static/a.png', { sha: 'new', workflow: { branch: BRANCH } }),
      ]);

      mergeWorkflowAssets([
        createAsset('static/a.png', { sha: 'newer', workflow: { branch: BRANCH } }),
      ]);

      expect(allAssets.current[0].sha).toBe('newer');
      expect(allAssets.current[0].workflow?.replacedAsset).toBe(published);
    });
  });

  describe('removeWorkflowAssets', () => {
    test('drops an asset that has no published version', () => {
      allAssets.current = [
        createAsset('static/a.png'),
        createAsset('static/b.png', { workflow: { branch: BRANCH } }),
      ];

      removeWorkflowAssets(BRANCH);

      expect(allAssets.current.map(({ path }) => path)).toEqual(['static/a.png']);
    });

    test('restores the published version it was shadowing', () => {
      const published = createAsset('static/a.png', { sha: 'old' });

      allAssets.current = [published];
      mergeWorkflowAssets([
        createAsset('static/a.png', { sha: 'new', workflow: { branch: BRANCH } }),
      ]);
      removeWorkflowAssets(BRANCH);

      expect(allAssets.current).toEqual([published]);
    });

    test('leaves the assets of another branch alone', () => {
      allAssets.current = [
        createAsset('static/a.png', { workflow: { branch: 'cms/posts/other' } }),
      ];
      removeWorkflowAssets(BRANCH);

      expect(allAssets.current).toHaveLength(1);
    });
  });

  describe('publishWorkflowAssets', () => {
    test('clears the workflow information', () => {
      allAssets.current = [
        createAsset('static/a.png', { workflow: { branch: BRANCH } }),
        createAsset('static/b.png', { workflow: { branch: 'cms/posts/other' } }),
        createAsset('static/c.png'),
      ];

      publishWorkflowAssets(BRANCH);

      expect(allAssets.current.map(({ workflow }) => workflow?.branch)).toEqual([
        undefined,
        'cms/posts/other',
        undefined,
      ]);

      // The property is removed rather than set to `undefined`
      expect('workflow' in allAssets.current[0]).toBe(false);
    });
  });
});
