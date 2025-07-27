// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { REPOSITORY_INFO_PLACEHOLDER } from './repository';

describe('git/shared/repository', () => {
  describe('REPOSITORY_INFO_PLACEHOLDER', () => {
    it('should have all required repository info properties', () => {
      expect(REPOSITORY_INFO_PLACEHOLDER).toEqual({
        service: '',
        label: '',
        owner: '',
        repo: '',
        branch: '',
        baseURL: '',
        treeBaseURL: '',
        blobBaseURL: '',
        isSelfHosted: false,
        databaseName: '',
      });
    });

    it('should have empty string values for string properties', () => {
      const stringProperties = [
        'service',
        'label',
        'owner',
        'repo',
        'branch',
        'baseURL',
        'treeBaseURL',
        'blobBaseURL',
        'databaseName',
      ];

      stringProperties.forEach((prop) => {
        expect(REPOSITORY_INFO_PLACEHOLDER[prop]).toBe('');
      });
    });

    it('should have false as default for isSelfHosted', () => {
      expect(REPOSITORY_INFO_PLACEHOLDER.isSelfHosted).toBe(false);
    });

    it('should be immutable placeholder object', () => {
      const original = { ...REPOSITORY_INFO_PLACEHOLDER };

      // Try to modify the placeholder (this shouldn't affect the original)
      REPOSITORY_INFO_PLACEHOLDER.service = 'github';

      expect(REPOSITORY_INFO_PLACEHOLDER.service).toBe('github');
      expect(original.service).toBe('');
    });
  });
});
