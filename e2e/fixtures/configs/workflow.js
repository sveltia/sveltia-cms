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

/**
 * The same blog with Open Authoring turned on: a user who can’t write to the repository works on a
 * fork of it instead. Set `github.canWrite` to `false` to sign in as such a contributor.
 */
export const OPEN_AUTHORING_CONFIG = {
  ...WORKFLOW_CONFIG,
  backend: { ...WORKFLOW_CONFIG.backend, open_authoring: true, auth_scope: 'public_repo' },
};

/**
 * Save a post to a branch in the contributor’s fork the way the CMS does, on a
 * `cms/{owner}/{repo}/posts/{slug}` branch. The fork has to exist. Like the CMS, this opens no pull
 * request: the entry is a draft until the contributor sends it for review.
 * @param {MockGitHub} github GitHub mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @returns {string} Branch key in the mock, e.g. `mona:cms/mona/e2e-site/posts/{slug}`.
 */
export const saveForkDraft = (github, { slug, files }) => {
  const branch = github.forkBranch(`cms/${github.user.login}/${github.repo}/posts/${slug}`);

  github.createBranch(branch, github.head.oid);
  github.commit(files, { branch, author: github.user, message: `Create Post “${slug}”` });

  return branch;
};
