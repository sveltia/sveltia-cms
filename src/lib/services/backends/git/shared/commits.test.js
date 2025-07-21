// @ts-nocheck
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCommitMessage } from './commits';

// Mock the get function from svelte/store
const mockSiteConfig = {
  backend: {
    commit_messages: {},
    automatic_deployments: true,
  },
};

const mockUser = {
  login: 'test-user',
  name: 'Test User',
};

vi.mock('svelte/store', () => ({
  get: vi.fn((store) => {
    // Mock different returns based on what store is being accessed
    if (store?.name === 'siteConfig') {
      return mockSiteConfig;
    }

    if (store?.name === 'user') {
      return mockUser;
    }

    return null;
  }),
}));

vi.mock('$lib/services/config', () => ({
  siteConfig: { name: 'siteConfig' },
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
    mockSiteConfig.backend = {
      commit_messages: {},
      automatic_deployments: true,
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
      mockSiteConfig.backend.automatic_deployments = false;

      const message = createCommitMessage(mockChanges, {
        commitType: 'create',
        collection: mockCollection,
      });

      expect(message).toBe('[skip ci] Create Blog Post “my-post”');
    });

    it('should not add [skip ci] prefix for delete operations', () => {
      mockSiteConfig.backend.automatic_deployments = false;

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
  });
});
