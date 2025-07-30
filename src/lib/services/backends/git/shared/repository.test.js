// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { getRepoURL, REPOSITORY_INFO_PLACEHOLDER } from './repository';

describe('git/shared/repository', () => {
  describe('REPOSITORY_INFO_PLACEHOLDER', () => {
    it('should have all required repository info properties', () => {
      expect(REPOSITORY_INFO_PLACEHOLDER).toEqual({
        service: '',
        label: '',
        owner: '',
        repo: '',
        branch: '',
        repoURL: '',
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
        'repoURL',
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

  describe('getRepoURL', () => {
    const defaultRepoPath = 'owner/repo';

    it('should handle GitHub.com API URL correctly', () => {
      const restApiRoot = 'https://api.github.com';
      const expected = 'https://github.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from GitHub Enterprise Server API URL', () => {
      const restApiRoot = 'https://github.example.com/api/v3';
      const expected = 'https://github.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from GitLab API URL', () => {
      const restApiRoot = 'https://gitlab.example.com/api/v4';
      const expected = 'https://gitlab.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from Gitea API URL', () => {
      const restApiRoot = 'https://example.com/gitea/api/v1';
      const expected = 'https://example.com/gitea/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should extract base URL from custom self-hosted API URL', () => {
      const restApiRoot = 'https://git.company.com/api/v3';
      const repoPath = 'team/project';
      const expected = 'https://git.company.com/team/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle API URL with nested path', () => {
      const restApiRoot = 'https://example.com/git/api/v3/extra';
      const expected = 'https://example.com/git/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should return URL with repo path if no /api path is found', () => {
      const restApiRoot = 'https://example.com/git';
      const expected = 'https://example.com/git/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle URL with /api at the end', () => {
      const restApiRoot = 'https://example.com/api';
      const expected = 'https://example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle empty string inputs', () => {
      const expected = '/';

      expect(getRepoURL('', '')).toBe(expected);
    });

    it('should handle URL with multiple /api segments (first occurrence)', () => {
      const restApiRoot = 'https://example.com/some/api/path/api/v1';
      const expected = 'https://example.com/some/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle URL with port number', () => {
      const restApiRoot = 'https://gitlab.local:8080/api/v4';
      const repoPath = 'group/project';
      const expected = 'https://gitlab.local:8080/group/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle URL with subdirectory and API path', () => {
      const restApiRoot = 'https://example.com/git/server/api/v1';
      const expected = 'https://example.com/git/server/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });

    it('should handle complex repository paths', () => {
      const restApiRoot = 'https://gitlab.example.com/api/v4';
      const repoPath = 'group/subgroup/project';
      const expected = 'https://gitlab.example.com/group/subgroup/project';

      expect(getRepoURL(restApiRoot, repoPath)).toBe(expected);
    });

    it('should handle API URL with version numbers correctly', () => {
      const restApiRoot = 'https://github.example.com/api/v3';
      const expected = 'https://github.example.com/owner/repo';

      expect(getRepoURL(restApiRoot, defaultRepoPath)).toBe(expected);
    });
  });
});
