import { afterEach, describe, expect, test } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import {
  boardStages,
  getEntryStage,
  getNextStage,
  getWorkflowStages,
  isLastStage,
  resolveStage,
  workflowPageLabelKey,
} from '$lib/services/workflow/stages';

/**
 * Create an unpublished entry with the given status.
 * @param {string} status Status.
 * @returns {any} Entry.
 */
const createEntry = (status) => ({ workflow: { status } });
/** @type {any} */
const preview = { name: 'preview', publish_mode: 'preview' };

/** @type {any} */
const noReview = {
  name: 'no-review',
  publish_mode: { type: 'editorial_workflow', stages: ['draft', 'pending_publish'] },
};

describe('workflow/stages', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
    forkedRepository.current = undefined;
  });

  describe('getWorkflowStages', () => {
    test('gives every stage by default', () => {
      expect(getWorkflowStages(undefined)).toEqual(['draft', 'pending_review', 'pending_publish']);
    });

    test('gives the configured stages of the collection', () => {
      expect(getWorkflowStages(preview)).toEqual(['draft']);
      expect(getWorkflowStages(noReview)).toEqual(['draft', 'pending_publish']);
    });

    test('gives an Open Authoring contributor their own stages, whatever the collection says', () => {
      forkedRepository.current = { owner: 'me', repo: 'site' };
      expect(getWorkflowStages(preview)).toEqual(['draft', 'pending_review']);
      expect(getWorkflowStages(noReview)).toEqual(['draft', 'pending_review']);
    });
  });

  describe('resolveStage', () => {
    test('gives a configured stage as is', () => {
      expect(resolveStage('pending_review', ['draft', 'pending_review'])).toBe('pending_review');
    });

    test('falls back to the nearest earlier stage', () => {
      expect(resolveStage('pending_review', ['draft', 'pending_publish'])).toBe('draft');
      expect(resolveStage('pending_publish', ['draft', 'pending_review'])).toBe('pending_review');
      expect(resolveStage('pending_publish', ['draft'])).toBe('draft');
    });

    test('leaves a pending deletion alone', () => {
      expect(resolveStage('pending_deletion', ['draft'])).toBe('pending_deletion');
    });

    test('gives the drafting stage for an unknown status', () => {
      expect(resolveStage(/** @type {any} */ ('unknown'), [])).toBe('draft');
    });
  });

  describe('getEntryStage, getNextStage and isLastStage', () => {
    test('follow the stages of the collection', () => {
      expect(getEntryStage(createEntry('pending_review'), noReview)).toBe('draft');
      expect(getNextStage(createEntry('draft'), undefined)).toBe('pending_review');
      expect(getNextStage(createEntry('pending_review'), noReview)).toBe('pending_publish');
      expect(getNextStage(createEntry('pending_publish'), undefined)).toBeUndefined();
      expect(getNextStage(createEntry('pending_deletion'), undefined)).toBeUndefined();
      expect(getNextStage(createEntry('draft'), preview)).toBeUndefined();
      expect(isLastStage(createEntry('pending_publish'), undefined)).toBe(true);
      expect(isLastStage(createEntry('draft'), undefined)).toBe(false);
      expect(isLastStage(createEntry('draft'), preview)).toBe(true);
      // An entry labelled ready elsewhere can be published right away with Preview Workflow
      expect(isLastStage(createEntry('pending_review'), preview)).toBe(true);
      expect(isLastStage(createEntry('pending_deletion'), preview)).toBe(false);
    });
  });

  describe('boardStages and workflowPageLabelKey', () => {
    test('give every stage of Editorial Workflow', () => {
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(boardStages.current).toEqual(['draft', 'pending_review', 'pending_publish']);
      expect(workflowPageLabelKey.current).toBe('editorial_workflow');
    });

    test('give the drafting stage alone when everything uses Preview Workflow', () => {
      cmsConfig.current = /** @type {any} */ ({
        publish_mode: 'preview',
        collections: [
          { divider: true },
          { name: 'posts' },
          { name: 'pages', publish_mode: 'simple' },
        ],
      });
      expect(boardStages.current).toEqual(['draft']);
      expect(workflowPageLabelKey.current).toBe('drafts');
    });

    test('combine the stages of the site and the collections', () => {
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'preview', collections: [noReview] });
      expect(boardStages.current).toEqual(['draft', 'pending_publish']);

      cmsConfig.current = /** @type {any} */ ({ collections: [preview, noReview] });
      expect(boardStages.current).toEqual(['draft', 'pending_publish']);
      expect(workflowPageLabelKey.current).toBe('editorial_workflow');
    });

    test('give an Open Authoring contributor their own stages', () => {
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'preview' });
      forkedRepository.current = { owner: 'me', repo: 'site' };
      expect(boardStages.current).toEqual(['draft', 'pending_review']);
    });
  });
});
