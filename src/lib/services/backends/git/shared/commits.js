import { mapConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { cmsConfig } from '$lib/services/config';
import { getCollectionLabel } from '$lib/services/contents/collection';
import { user } from '$lib/services/user/account.svelte';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { CommitOptions, FileChange, FileCommit, User } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Default commit message templates.
 * @see https://decapcms.org/docs/configuration-options/#commit-message-templates
 * @see https://sveltiacms.app/en/docs/backends#commit-messages
 */
const DEFAULT_COMMIT_MESSAGES = {
  create: 'Create {{collection}} “{{slug}}”',
  update: 'Update {{collection}} “{{slug}}”',
  delete: 'Delete {{collection}} “{{slug}}”',
  uploadMedia: 'Upload “{{path}}”',
  deleteMedia: 'Delete “{{path}}”',
  openAuthoring: '{{message}}',
};

/**
 * Markers that tell a CI/CD provider not to build a commit. GitHub Actions and Gitea Actions honour
 * `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]` and `[actions skip]`, GitLab CI honours
 * `[skip ci]` and `[ci skip]`, and Cloudflare Pages accepts the same words hyphenated as well as
 * `[cf-pages-skip]`. They all match case-insensitively anywhere in the message, so this does too:
 * the marker is written as a prefix here, but a commit made elsewhere can carry it in the body.
 * @see https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs
 * @see https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline
 * @see https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds
 */
const SKIP_CI_REGEX =
  /\[(?:skip[ -](?:ci|actions)|(?:ci|actions)[ -]skip|no[ -]ci|cf-pages-skip)\]/i;

/**
 * Check if a commit message carries a marker that keeps the connected CI/CD provider from building
 * the commit. It says what the author asked for, not what the provider did: a repository with no CI
 * at all never builds an unmarked commit either.
 * @param {string} message Commit message.
 * @returns {boolean} Result.
 */
export const hasSkipCIMarker = (message) => SKIP_CI_REGEX.test(message);

/**
 * Replace the `{{name}}` placeholders in the given commit message template with the given values,
 * in a single pass. The values are inserted as they are: `$&` and the like aren’t read as
 * replacement patterns, and a placeholder that happens to appear in a value, e.g. in a slug, isn’t
 * expanded. A placeholder without a value is left as it is.
 * @param {string} template Template.
 * @param {Record<string, string>} values Values keyed by placeholder name.
 * @returns {string} Filled message.
 */
const fillTemplate = (template, values) =>
  template.replace(/\{\{([\w-]+)\}\}/g, (placeholder, key) =>
    Object.hasOwn(values, key) ? values[key] : placeholder,
  );

/**
 * Create a Git commit message.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {string} Formatted message.
 */
export const createCommitMessage = (
  changes,
  { commitType = 'update', collection, skipCI = undefined },
) => {
  const {
    commit_messages: customCommitMessages = {},
    skip_ci: skipCIEnabled,
    automatic_deployments: autoDeploy,
  } = /** @type {GitBackend} */ (cmsConfig.current?.backend ?? {});

  const { email = '', login = '', name = '' } = /** @type {User} */ (user.account);
  const [firstSlug = ''] = changes.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = changes.map(({ path }) => path);
  const collectionLabel = collection ? getCollectionLabel(collection, { useSingular: true }) : '';
  // @ts-ignore
  let message = customCommitMessages[commitType] || DEFAULT_COMMIT_MESSAGES[commitType] || '';
  const authorValues = { 'author-email': email, 'author-login': login, 'author-name': name };

  if (['create', 'update', 'delete'].includes(commitType)) {
    message = fillTemplate(message, {
      slug: firstSlug,
      collection: collectionLabel,
      path: firstPath,
      ...authorValues,
    });
  }

  if (['uploadMedia', 'deleteMedia'].includes(commitType)) {
    message = fillTemplate(message, { path: firstPath, ...authorValues });
  }

  if (remainingPaths.length) {
    message += ` +${remainingPaths.length}`;
  }

  // With Open Authoring the commit is made by an outside contributor, so the message can be wrapped
  // to record who wrote it. The default template is the message on its own, which changes nothing
  if (openAuthoring.current) {
    message = fillTemplate(
      customCommitMessages.openAuthoring || DEFAULT_COMMIT_MESSAGES.openAuthoring,
      { message, ...authorValues },
    );
  }

  // If requested, disable automatic deployments by using the standard `[skip ci]` prefix supported
  // by major CI/CD providers, including GitHub Actions and Cloudflare Pages. To avoid unexpected
  // data retention, deployments for deletion commits are not skipped.
  // https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs
  // https://docs.gitlab.com/ee/ci/pipelines/#skip-a-pipeline
  // https://developers.cloudflare.com/pages/platform/branch-build-controls/#skip-builds
  if (
    !['delete', 'deleteMedia'].includes(commitType) &&
    // Cannot use the `skipCIEnabled` store here because it leads to an uninitialized store error
    (skipCI ?? (skipCIEnabled === true || autoDeploy === false))
  ) {
    message = `[skip ci] ${message}`;
  }

  return message;
};

/**
 * Merge the commit histories of several files into one list. A commit touching more than one of the
 * files appears in each history, so only its first occurrence is kept.
 * @param {FileCommit[]} commits Commits, possibly with duplicates.
 * @returns {FileCommit[]} Unique commits, newest first.
 */
export const dedupeFileCommits = (commits) => {
  /** @type {Map<string, FileCommit>} */
  const commitMap = new Map();

  commits.forEach((commit) => {
    if (!commitMap.has(commit.sha)) {
      commitMap.set(commit.sha, commit);
    }
  });

  return [...commitMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * Throw an error telling the user that the branch has moved, if its head is no longer the one a
 * refused commit was based on. This tells a commit refused over a moved head from any other
 * failure, so the user is told what happened and to try again, which picks up the other change
 * first. The head is looked up rather than the wording of the error relied upon. A failed lookup
 * returns quietly, leaving the original error to be reported.
 * @param {string} expectedHead SHA of the head commit the refused commit was based on.
 * @param {() => Promise<{ hash: string }>} fetchLastCommit Function to fetch the branch’s head.
 * @throws {Error} When the branch has moved.
 */
export const assertBranchNotMoved = async (expectedHead, fetchLastCommit) => {
  const head = await fetchLastCommit().catch(() => undefined);

  if (head && head.hash !== expectedHead) {
    throw createLocalizedError(
      'The branch has moved since the site data was loaded.',
      'save_conflict.branch_moved',
    );
  }
};

/**
 * Fetch the commit history of each of the given files with a separate request, keeping only a few
 * requests in flight at a time so a long list doesn’t trigger a Too Many Requests error, then merge
 * the histories into one list.
 * @param {string[]} paths File paths to fetch commit history for.
 * @param {(path: string) => Promise<any[]>} fetchHistory Function to fetch the raw commit list of a
 * file from the backend’s API.
 * @param {(commit: any) => FileCommit} parseCommit Function to convert a raw commit to a
 * {@link FileCommit}.
 * @returns {Promise<FileCommit[]>} Unique commits, newest first.
 */
export const fetchPerPathCommits = async (paths, fetchHistory, parseCommit) => {
  const results = await mapConcurrently(paths, fetchHistory);

  return dedupeFileCommits(results.flat().map(parseCommit));
};
