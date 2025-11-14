// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommitMessage } from './commits';

// Mock the get function from svelte/store
const mockCmsConfig = {
  backend: {
    commit_messages: {},
    skip_ci: false,
  },
};

const mockUser = {
  login: 'test-user',
  name: 'Test User',
};

vi.mock('svelte/store', () => ({
  get: vi.fn((store) => {
    // Mock different returns based on what store is being accessed
    if (store?.name === 'cmsConfig') {
      return mockCmsConfig;
    }

    if (store?.name === 'user') {
      return mockUser;
    }

    return null;
  }),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { name: 'cmsConfig' },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollectionLabel: vi.fn(() => 'Blog Post'),
}));

vi.mock('$lib/services/user', () => ({
  user: { name: 'user' },
}));

describe('git/shared/commits', () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Reset mock data
    mockCmsConfig.backend = {
      commit_messages: {},
      skip_ci: false,
      automatic_deployments: undefined,
    };
    mockUser.login = 'test-user';
    mockUser.name = 'Test User';
  });

  describe('createCommitMessage', () => {
    const mockChanges = [
      {
        path: 'content/blog/my-post.md',
        slug: 'my-post',
      },
    ];

    const mockCollection = {
      name: 'blog',
      label: 'Blog',
    };

    it('should create default create message', () => {
      const changes = [{ slug: 'my-post', path: 'content/posts/my-post.md' }];
      const options = { commitType: 'create', collection: mockCollection };
      const message = createCommitMessage(changes, options);

      expect(message).toBe('Create Blog Post “my-post”');
    });

    it('should create default update message', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post “my-post”');
    });

    it('should create default delete message', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'delete',
        collection: mockCollection,
      });

      expect(message).toBe('Delete Blog Post “my-post”');
    });

    it('should create default uploadMedia message', () => {
      const mediaChanges = [
        {
          path: 'static/images/photo.jpg',
        },
      ];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'uploadMedia',
      });

      expect(message).toBe('Upload “static/images/photo.jpg”');
    });

    it('should create uploadMedia message with multiple files', () => {
      const mediaChanges = [
        { path: 'static/images/photo1.jpg' },
        { path: 'static/images/photo2.jpg' },
        { path: 'static/images/photo3.jpg' },
      ];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'uploadMedia',
      });

      expect(message).toBe('Upload “static/images/photo1.jpg” +2');
    });

    it('should add [skip ci] prefix when automatic deployments are disabled', () => {
      mockCmsConfig.backend.skip_ci = true;

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Create Blog Post “my-post”');
    });

    it('should not add [skip ci] prefix for delete operations', () => {
      mockCmsConfig.backend.skip_ci = true;

      const message = createCommitMessage(mockChanges, {
        commitType: 'delete',
        collection: mockCollection,
      });

      expect(message).toBe('Delete Blog Post “my-post”');
    });

    it('should handle empty user data gracefully', () => {
      mockUser.login = '';
      mockUser.name = '';

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post “my-post”');
    });

    it('should handle openAuthoring commit type', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'openAuthoring',
      });

      expect(message).toBe('openAuthoring');
    });

    it('should add [skip ci] prefix for openAuthoring when enabled', () => {
      mockCmsConfig.backend.skip_ci = true;

      const message = createCommitMessage(mockChanges, {
        commitType: 'openAuthoring',
      });

      expect(message).toBe('[skip ci] openAuthoring');
    });

    it('should not add [skip ci] prefix for deleteMedia operations', () => {
      mockCmsConfig.backend.skip_ci = true;

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
      });

      expect(message).toBe('Delete “static/images/photo.jpg”');
    });

    it('should add [skip ci] prefix for deleteMedia when skipCI param is true', () => {
      mockCmsConfig.backend.skip_ci = false;

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
        skipCI: true,
      });

      expect(message).toBe('Delete “static/images/photo.jpg”');
    });

    it('should use custom commit messages when provided', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          create: 'New {{collection}}: {{slug}}',
          update: 'Modified {{collection}}: {{slug}}',
          delete: 'Removed {{collection}}: {{slug}}',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('New Blog Post: my-post');
    });

    it('should use custom uploadMedia message when provided', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          uploadMedia: 'Uploaded: {{path}}',
        },
        skip_ci: false,
      };

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'uploadMedia',
      });

      expect(message).toBe('Uploaded: static/images/photo.jpg');
    });

    it('should use custom deleteMedia message when provided', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          deleteMedia: 'Removed: {{path}}',
        },
        skip_ci: false,
      };

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
      });

      expect(message).toBe('Removed: static/images/photo.jpg');
    });

    it('should handle automatic_deployments config option', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: undefined,
        automatic_deployments: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Update Blog Post “my-post”');
    });

    it('should use skipCI parameter to override config', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: false,
        automatic_deployments: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
        skipCI: true,
      });

      expect(message).toBe('[skip ci] Update Blog Post “my-post”');
    });

    it('should handle changes with no slug', () => {
      const changes = [{ path: 'content/posts/post.md', slug: '' }];

      const message = createCommitMessage(changes, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post “”');
    });

    it('should use first slug from multiple changes', () => {
      const changes = [
        { path: 'content/posts/first.md', slug: 'first-post' },
        { path: 'content/posts/second.md', slug: 'second-post' },
      ];

      const message = createCommitMessage(changes, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post “first-post”');
    });

    it('should handle deleteMedia with multiple files', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
      };

      const mediaChanges = [
        { path: 'static/images/photo1.jpg' },
        { path: 'static/images/photo2.jpg' },
        { path: 'static/images/photo3.jpg' },
      ];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
      });

      expect(message).toBe('Delete “static/images/photo1.jpg” +2');
    });

    it('should handle openAuthoring without collection', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'openAuthoring',
      });

      expect(message).toBe('openAuthoring');
    });

    it('should apply [skip ci] prefix to openAuthoring', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'openAuthoring',
      });

      expect(message).toBe('[skip ci] openAuthoring');
    });

    it('should not apply [skip ci] when skipCI is explicitly false', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
        automatic_deployments: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
        skipCI: false,
      });

      expect(message).toBe('Update Blog Post “my-post”');
    });

    it('should not apply [skip ci] when automatic_deployments is true and skip_ci is undefined', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: undefined,
        automatic_deployments: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post “my-post”');
    });

    it('should not apply [skip ci] to deleteMedia even if skip_ci is true', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
      };

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
      });

      expect(message).toBe('Delete “static/images/photo.jpg”');
    });

    it('should not apply [skip ci] to delete even if skip_ci is true', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'delete',
        collection: mockCollection,
      });

      expect(message).toBe('Delete Blog Post “my-post”');
    });

    it('should not add skip ci when skipCI is explicitly false', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
        automatic_deployments: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
        skipCI: false,
      });

      expect(message).toBe('Update Blog Post “my-post”');
    });

    it('should not add skip ci when autoDeploy is true', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: false,
        automatic_deployments: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post “my-post”');
    });

    it('should handle null collection gracefully', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: null,
      });

      expect(message).toBe('Create  “my-post”');
    });

    it('should handle undefined collection gracefully', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        // collection is undefined
      });

      expect(message).toBe('Update  “my-post”');
    });

    it('should handle unknown commit type gracefully', () => {
      const message = createCommitMessage(mockChanges, {
        commitType: 'unknownType',
      });

      expect(message).toBe('');
    });

    it('should handle custom commit message for unknown type', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          unknownType: 'Custom message',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'unknownType',
      });

      expect(message).toBe('Custom message');
    });

    it('should add [skip ci] when autoDeploy is false and skipCIEnabled is undefined', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: undefined,
        automatic_deployments: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Create Blog Post “my-post”');
    });

    it('should add [skip ci] when skipCIEnabled is true but automatic_deployments is undefined', () => {
      mockCmsConfig.backend = {
        commit_messages: {},
        skip_ci: true,
        automatic_deployments: undefined,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Update Blog Post “my-post”');
    });
  });
});
