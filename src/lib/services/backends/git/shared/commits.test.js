// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommitMessage, hasSkipCIMarker } from './commits';

// Mock the get function from svelte/store
const mockCmsConfig = {
  backend: {
    commit_messages: {},
    skip_ci: false,
  },
};

const mockUser = vi.hoisted(() => ({
  login: 'test-user',
  name: 'Test User',
  email: '',
}));

// Whether the commit is being made by an Open Authoring contributor
const mockState = vi.hoisted(() => ({ openAuthoring: false }));

vi.mock('svelte/store', () => ({
  get: vi.fn((store) => {
    // Mock different returns based on what store is being accessed
    if (store?.name === 'cmsConfig') {
      return mockCmsConfig;
    }

    if (store?.name === 'openAuthoring') {
      return mockState.openAuthoring;
    }

    return null;
  }),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { name: 'cmsConfig' },
}));

vi.mock('$lib/services/workflow/open-authoring', () => ({
  openAuthoring: { name: 'openAuthoring' },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollectionLabel: vi.fn(() => 'Blog Post'),
}));

vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: mockUser },
}));

describe('git/shared/commits', () => {
  afterEach(() => {
    mockState.openAuthoring = false;
    vi.clearAllMocks();
    // Reset mock data
    mockCmsConfig.backend = {
      commit_messages: {},
      skip_ci: false,
      automatic_deployments: undefined,
    };
    mockUser.login = 'test-user';
    mockUser.name = 'Test User';
    mockUser.email = '';
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

    it('should leave the message alone for open authoring by default', () => {
      mockState.openAuthoring = true;

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post “my-post”');
    });

    it('should wrap the message with the custom openAuthoring template', () => {
      mockState.openAuthoring = true;
      mockCmsConfig.backend.commit_messages = {
        openAuthoring: '{{message}} (by {{author-login}})',
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post “my-post” (by test-user)');
    });

    it('should not wrap the message when open authoring is off', () => {
      mockCmsConfig.backend.commit_messages = {
        openAuthoring: '{{message}} (by {{author-login}})',
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post “my-post”');
    });

    it('should add [skip ci] prefix outside the openAuthoring wrapper', () => {
      mockState.openAuthoring = true;
      mockCmsConfig.backend.skip_ci = true;
      mockCmsConfig.backend.commit_messages = {
        openAuthoring: '{{message}} (by {{author-name}} <{{author-email}}>)',
      };
      mockUser.email = 'me@example.com';

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Create Blog Post “my-post” (by Test User <me@example.com>)');
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

      expect(message).toBe('Update Blog Post “first-post” +1');
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

    it('should wrap the message after the +N suffix for open authoring', () => {
      mockState.openAuthoring = true;
      mockCmsConfig.backend.commit_messages = {
        openAuthoring: '{{message}} (by {{author-login}})',
      };

      const multiChanges = [
        { path: 'content/posts/a.md', slug: 'a' },
        { path: 'content/posts/b.md', slug: 'b' },
        { path: 'content/posts/c.md', slug: 'c' },
      ];

      const message = createCommitMessage(multiChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post “a” +2 (by test-user)');
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

    it('should replace {{author-login}} placeholder in create message', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          create: 'Create {{collection}} "{{slug}}" by {{author-login}}',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post "my-post" by test-user');
    });

    it('should replace {{author-name}} placeholder in update message', () => {
      mockCmsConfig.backend = {
        commit_messages: {
          update: 'Update {{collection}} "{{slug}}" by {{author-name}}',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'update',
        collection: mockCollection,
      });

      expect(message).toBe('Update Blog Post "my-post" by Test User');
    });

    it('should replace {{author-email}} placeholder in delete message', () => {
      mockUser.email = 'test@example.com';

      mockCmsConfig.backend = {
        commit_messages: {
          delete: 'Delete {{collection}} "{{slug}}" ({{author-email}})',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'delete',
        collection: mockCollection,
      });

      expect(message).toBe('Delete Blog Post "my-post" (test@example.com)');
    });

    it('should replace multiple author placeholders in one message', () => {
      mockUser.email = 'test@example.com';

      mockCmsConfig.backend = {
        commit_messages: {
          create:
            'Create {{collection}} "{{slug}}" by {{author-name}} ({{author-login}}) <{{author-email}}>',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe(
        'Create Blog Post "my-post" by Test User (test-user) <test@example.com>',
      );
    });

    it('should replace author placeholders in uploadMedia message', () => {
      mockUser.email = 'test@example.com';

      mockCmsConfig.backend = {
        commit_messages: {
          uploadMedia: 'Upload "{{path}}" by {{author-name}} ({{author-email}})',
        },
        skip_ci: false,
      };

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'uploadMedia',
      });

      expect(message).toBe('Upload "static/images/photo.jpg" by Test User (test@example.com)');
    });

    it('should replace author placeholders in deleteMedia message', () => {
      mockUser.email = 'test@example.com';

      mockCmsConfig.backend = {
        commit_messages: {
          deleteMedia: 'Delete "{{path}}" by {{author-login}}',
        },
        skip_ci: false,
      };

      const mediaChanges = [{ path: 'static/images/photo.jpg' }];

      const message = createCommitMessage(mediaChanges, {
        commitType: 'deleteMedia',
      });

      expect(message).toBe('Delete "static/images/photo.jpg" by test-user');
    });

    it('should handle missing author properties gracefully', () => {
      mockUser.login = '';
      mockUser.name = '';
      mockUser.email = '';

      mockCmsConfig.backend = {
        commit_messages: {
          create:
            'Create {{collection}} "{{slug}}" by {{author-name}} ({{author-login}}) <{{author-email}}>',
        },
        skip_ci: false,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('Create Blog Post "my-post" by  () <>');
    });

    it('should replace author placeholders with [skip ci] prefix', () => {
      mockUser.email = 'test@example.com';

      mockCmsConfig.backend = {
        commit_messages: {
          create: 'Create {{collection}} "{{slug}}" by {{author-email}}',
        },
        skip_ci: true,
      };

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Create Blog Post "my-post" by test@example.com');
    });

    it('should use empty defaults when backend is undefined (line 40 ?? {} branch)', () => {
      // Setting backend to undefined causes `get(cmsConfig)?.backend ?? {}` to fire
      mockCmsConfig.backend = undefined;

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      // With no backend config, uses default commit message with no skip_ci
      expect(typeof message).toBe('string');
      expect(message).not.toBe('');
    });
  });

  describe('hasSkipCIMarker', () => {
    it('should match the marker this CMS writes', () => {
      expect(hasSkipCIMarker('[skip ci] Update Post “hello”')).toBe(true);
    });

    it('should match the other markers the Git services honour', () => {
      [
        '[ci skip] Update',
        '[no ci] Update',
        '[skip actions] Update',
        '[actions skip] Update',
        '[skip-ci] Update',
        '[cf-pages-skip] Update',
      ].forEach((message) => {
        expect(hasSkipCIMarker(message)).toBe(true);
      });
    });

    it('should ignore the case, as the services do', () => {
      expect(hasSkipCIMarker('[Skip CI] Update')).toBe(true);
    });

    it('should match a marker anywhere in the message', () => {
      expect(hasSkipCIMarker('Merge pull request #1\n\nUpdate posts [ci skip]')).toBe(true);
    });

    it('should not match an ordinary message', () => {
      ['Update Post “hello”', 'Fix the skip ci docs', 'Mention [ci] in the guide'].forEach(
        (message) => {
          expect(hasSkipCIMarker(message)).toBe(false);
        },
      );
    });
  });
});
