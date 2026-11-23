import { vi } from 'vitest';

// Test data builders shared by the Editorial Workflow save and removal tests. This module imports
// nothing from the app, so a test can mock any app module.

/**
 * Mock of the backend’s Editorial Workflow implementation.
 */
export const workflowService = {
  fetchPullRequests: vi.fn(),
  savePullRequest: vi.fn(),
  updateStatus: vi.fn(),
  approve: vi.fn(),
  withdrawApproval: vi.fn(),
  /** The pull request as read right before the merge. */
  fetchMergeState: vi.fn(async () => ({
    headSHA: 'abc',
    onConfiguredBranches: true,
    files: [],
    complete: true,
  })),
  fetchUnchangedPaths: vi.fn(),
  publish: vi.fn(),
  discard: vi.fn(),
};

/**
 * Create a minimal unpublished entry for testing.
 * @param {string} branch Branch name.
 * @param {string} [status] Workflow status.
 * @returns {any} Unpublished entry.
 */
export const createEntry = (branch, status = 'draft') => ({
  id: branch,
  slug: 'hello',
  subPath: 'hello',
  locales: { _default: { slug: 'hello', path: 'content/posts/hello.md', content: {} } },
  workflow: {
    pullRequest: { branch, number: 1, files: [], status },
    status,
    collectionName: 'posts',
    fileName: undefined,
  },
});

/**
 * Create a new entry of another collection riding along in a pull request.
 * @param {string} slug Slug.
 * @param {string} [title] Title.
 * @returns {any} Companion entry.
 */
export const createCompanion = (slug, title = slug) => ({
  collectionName: 'sections',
  entry: {
    id: `section-${slug}`,
    slug,
    subPath: slug,
    locales: { _default: { slug, path: `content/sections/${slug}.md`, content: { title } } },
  },
});

/**
 * Classify the given files like the real file list does, by their folder.
 * @param {{ path: string }[]} files Files.
 * @returns {any} Entry and asset files.
 */
export const classifyFiles = (files) => ({
  entryFiles: files.filter(({ path }) => path.startsWith('content/')),
  assetFiles: files.filter(({ path }) => path.startsWith('static/')),
});
