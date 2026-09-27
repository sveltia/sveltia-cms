import { GITHUB_CONFIG } from '../test.js';

/**
 * @import { MockGitHub, MockPullRequest } from '../github.js';
 */

/**
 * The GitHub blog with Editorial Workflow: saving an entry commits it to a branch of its own and
 * opens a pull request, which is merged when the entry is published. Use it with the `github`
 * fixture.
 */
export const WORKFLOW_CONFIG = { ...GITHUB_CONFIG, publish_mode: 'editorial_workflow' };

/**
 * Create the content of a post.
 * @param {string} title Title.
 * @param {string} body Body.
 * @returns {string} File content.
 */
export const post = (title, body) => `---\ntitle: ${title}\n---\n\n${body}\n`;

/**
 * Open a pull request for a post the way the CMS does: on a `cms/posts/{slug}` branch, with a
 * status label, and as a draft while the entry is a draft.
 * @param {MockGitHub} github GitHub mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @param {string} [args.status] Workflow status.
 * @returns {MockPullRequest} Pull request.
 */
export const openEntryPullRequest = (github, { slug, files, status = 'draft' }) => {
  const branch = `cms/posts/${slug}`;

  github.createBranch(branch, github.head.oid);
  github.commit(files, { branch, author: github.user, message: `Update Post “${slug}”` });

  return github.openPullRequest({
    title: `Update Post “${slug}”`,
    head: branch,
    draft: status === 'draft',
    labels: [`sveltia-cms/${status}`],
    author: github.user,
  });
};
