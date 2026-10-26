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
 * Get the backend options of the current configuration.
 * @returns {GitBackend} Options, which are empty if there is no configuration.
 */
const getBackendOptions = () => /** @type {GitBackend} */ (cmsConfig.current?.backend ?? {});

/**
 * Get the values of the author placeholders in a commit message template.
 * @returns {Record<string, string>} Values keyed by placeholder name.
 */
const getAuthorValues = () => {
  const { email = '', login = '', name = '' } = /** @type {User} */ (user.account);

  return { 'author-email': email, 'author-login': login, 'author-name': name };
};

/**
 * Create the part of a Git commit message that comes from the `commit_messages` template: the
 * template filled in, followed by the number of the other files changed, if any. It’s what the
 * user is shown when asked for a commit message.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @param {GitBackend} [backendOptions] Backend options. Default: those of the current
 * configuration.
 * @returns {string} Formatted message.
 */
export const createBaseCommitMessage = (
  changes,
  { commitType = 'update', collection },
  backendOptions = getBackendOptions(),
) => {
  const { commit_messages: customCommitMessages = {} } = backendOptions;
  const [firstSlug = ''] = changes.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = changes.map(({ path }) => path);
  const collectionLabel = collection ? getCollectionLabel(collection, { useSingular: true }) : '';
  // @ts-ignore
  let message = customCommitMessages[commitType] || DEFAULT_COMMIT_MESSAGES[commitType] || '';
  const authorValues = getAuthorValues();

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

  return message;
};

/**
 * Combine the message made from the template with the text the user has entered when asked for a
 * commit message, as the `prompt_commit_messages` backend option says.
 * @param {string} message Message made from the template.
 * @param {string | undefined} userMessage Text the user has entered.
 * @param {GitBackend['prompt_commit_messages']} mode Value of the `prompt_commit_messages` option.
 * @returns {string} Combined message.
 */
const applyUserMessage = (message, userMessage, mode) => {
  const text = userMessage?.trim();

  if (!text) {
    return message;
  }

  if (mode === true) {
    return text;
  }

  if (mode === 'prefix') {
    return `${text} ${message}`;
  }

  if (mode === 'suffix') {
    return `${message} ${text}`;
  }

  return message;
};

/**
 * Create a Git commit message.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {string} Formatted message.
 */
export const createCommitMessage = (changes, options) => {
  const { commitType = 'update', skipCI = undefined, userMessage } = options;
  const backendOptions = getBackendOptions();

  const {
    commit_messages: customCommitMessages = {},
    skip_ci: skipCIEnabled,
    automatic_deployments: autoDeploy,
    prompt_commit_messages: promptMode,
  } = backendOptions;

  let message = applyUserMessage(
    createBaseCommitMessage(changes, options, backendOptions),
    userMessage,
    promptMode,
  );

  // With Open Authoring the commit is made by an outside contributor, so the message can be wrapped
  // to record who wrote it. The default template is the message on its own, which changes nothing
  if (openAuthoring.current) {
    message = fillTemplate(
      customCommitMessages.openAuthoring || DEFAULT_COMMIT_MESSAGES.openAuthoring,
      { message, ...getAuthorValues() },
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
 * A Git trailer line: a token of letters, digits and hyphens, a colon and a value.
 * @see https://git-scm.com/docs/git-interpret-trailers
 */
const TRAILER_LINE_REGEX = /^[A-Za-z0-9-]+:\s*\S/;
/**
 * Clean up a user profile value for a commit trailer. Line breaks and angle brackets would break
 * the trailer, though a Git host doesn’t allow them in a name or an email.
 * @param {string | null | undefined} value Value. A field the host leaves empty can be `null`.
 * @returns {string} Cleaned value.
 */
const cleanTrailerValue = (value) => (value ?? '').replace(/[\s<>]+/g, ' ').trim();

/**
 * Add a `Signed-off-by` trailer with the signed-in user’s name and email to the given commit
 * message, if the `signoff_commits` backend option is enabled. The trailer joins the trailer block
 * the message already ends with, if any, and otherwise follows a blank line. A message that already
 * carries a sign-off with the user’s email, e.g. from a custom `commit_messages` template, is left
 * as it is. When the Git host doesn’t share the user’s email, as GitHub does for a user without a
 * public email, the trailer is left out with a warning.
 * @param {string} message Commit message.
 * @returns {string} Message, possibly with the trailer.
 * @see https://github.com/decaporg/decap-cms/pull/7766
 */
export const signOffCommitMessage = (message) => {
  if (!getBackendOptions().signoff_commits) {
    return message;
  }

  const { email, login, name } = /** @type {User} */ (user.account);
  const cleanEmail = cleanTrailerValue(email);

  if (!cleanEmail) {
    // eslint-disable-next-line no-console
    console.warn(
      'The `signoff_commits` option is enabled, but the Git host doesn’t share your email ' +
        'address, so commits are made without a `Signed-off-by` trailer.',
    );

    return message;
  }

  const author = cleanTrailerValue(name) || cleanTrailerValue(login) || cleanEmail;
  const text = message.trimEnd();
  const emailSuffix = `<${cleanEmail}>`.toLowerCase();

  // The user has already signed off if a trailer has their email, whichever name it goes with
  if (
    text.split(/\r?\n/).some((line) => {
      const normalized = line.trim().toLowerCase();

      return normalized.startsWith('signed-off-by:') && normalized.endsWith(emailSuffix);
    })
  ) {
    return message;
  }

  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  const lastParagraph = /** @type {string} */ (paragraphs.at(-1));

  const endsWithTrailers =
    paragraphs.length > 1 &&
    lastParagraph.split(/\r?\n/).every((line) => TRAILER_LINE_REGEX.test(line));

  return `${text}${endsWithTrailers ? '\n' : '\n\n'}Signed-off-by: ${author} <${cleanEmail}>`;
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
 * Create the error to throw when the last commit on the configured branch can’t be retrieved,
 * because the repository or the branch can’t be found.
 * @param {'repository_not_found' | 'branch_not_found'} key I18n key of the message to show.
 * @param {{ repo: string, branch?: string }} values Repository name, and the branch name for a
 * missing branch, to show in the message.
 * @returns {Error} Error.
 */
export const createLastCommitError = (key, values) =>
  createLocalizedError('Failed to retrieve the last commit hash.', key, values);

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
