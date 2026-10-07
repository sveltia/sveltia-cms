import { unique } from '@sveltia/utils/array';
import { isTextFileType } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import mime from 'mime';

import { fetchRawFile } from '$lib/services/backends/git/gitea/files';
import { getWorkflowRepository } from '$lib/services/backends/git/gitea/fork';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { deleteRemoteBranch } from '$lib/services/backends/git/shared/workflow';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * FileChange,
 * RepositoryPath,
 * WorkflowFile,
 * WorkflowPullRequest,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Number of items an instance returns per page unless configured otherwise, which is also the most
 * it lets a request ask for. A larger `limit` is silently clamped rather than refused.
 * @see https://docs.gitea.com/administration/config-cheat-sheet#api-api
 */
const DEFAULT_MAX_RESPONSE_ITEMS = 50;
/**
 * Maximum number of pages to read from a paginated list. Editorial Workflow is not meant to hold a
 * huge backlog, so this is a safety net against a runaway loop rather than a limit anyone should
 * reach.
 */
const MAX_PAGES = 10;
/**
 * The page size the instance applies, once it has been asked. Every list below is fetched with it,
 * because the instance cuts a larger page short without saying so.
 * @type {number | undefined}
 */
let pageSize;

/**
 * Reset the cached page size. Used for testing.
 */
export const resetPageSize = () => {
  pageSize = undefined;
};

/**
 * Get the page size the instance applies to a list. It’s asked once per session; the default is
 * used if the instance doesn’t report it.
 * @returns {Promise<number>} Page size.
 * @see https://docs.gitea.com/api/next/#tag/settings/operation/getGeneralAPISettings
 */
const getPageSize = async () => {
  if (pageSize === undefined) {
    const { max_response_items: maxItems } = /** @type {{ max_response_items?: number }} */ (
      await fetchAPI('/settings/api')
    );

    pageSize = Number(maxItems) || DEFAULT_MAX_RESPONSE_ITEMS;
  }

  return pageSize;
};

/**
 * Fetch the items of a paginated list. The instance clamps the page size to what it’s configured
 * with, so the pages are requested at that size and read until one comes back short, rather than
 * asking for one large page and silently losing whatever didn’t fit.
 * @param {string} path API endpoint path, with any query parameters of its own.
 * @returns {Promise<{ items: Record<string, any>[], complete: boolean }>} Items, and whether they
 * are all of them: the reading stops at {@link MAX_PAGES} pages, which may leave some out.
 */
export const fetchPages = async (path) => {
  const limit = await getPageSize();
  const separator = path.includes('?') ? '&' : '?';
  /** @type {Record<string, any>[]} */
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = /** @type {Record<string, any>[]} */ (
      // eslint-disable-next-line no-await-in-loop
      await fetchAPI(`${path}${separator}page=${page}&limit=${limit}`)
    );

    items.push(...result);

    if (result.length < limit) {
      return { items, complete: true };
    }
  }

  return { items, complete: false };
};

/**
 * Fetch every item of a paginated list, up to {@link MAX_PAGES} pages: see {@link fetchPages}.
 * @param {string} path API endpoint path, with any query parameters of its own.
 * @returns {Promise<Record<string, any>[]>} Items.
 */
export const fetchAllPages = async (path) => (await fetchPages(path)).items;

/**
 * Regular expression matching the work-in-progress indicators Gitea/Forgejo accepts at the
 * beginning of a pull request title. There’s no dedicated API field to toggle the draft state; the
 * read-only `draft` property is derived from the title instead. An instance can be configured with
 * its own prefixes, but the two defaults are what a pull request created by the CMS carries.
 * @see https://docs.gitea.com/administration/config-cheat-sheet
 */
const WIP_TITLE_REGEX = /^\s*(?:\[wip\]|wip:)\s*/i;
/**
 * Prefix added to a pull request title to mark it as a draft.
 */
const WIP_TITLE_PREFIX = 'WIP: ';

/**
 * Colors used for the CMS status labels, which have to be created on the instance before they can
 * be applied. The keys are {@link WorkflowStatus} values.
 * @type {Record<string, string>}
 */
const STATUS_LABEL_COLORS = {
  draft: '#ededed',
  pending_review: '#fbca04',
  pending_publish: '#0e8a16',
  pending_deletion: '#d93f0b',
};

/**
 * Description given to a CMS status label created on the instance.
 */
const STATUS_LABEL_DESCRIPTION = 'Editorial Workflow status managed by Sveltia CMS';

/**
 * Remove any work-in-progress indicator from the given pull request title.
 * @param {string} title Raw title.
 * @returns {string} Title without a WIP prefix.
 */
export const stripWipPrefix = (title) => {
  let result = title;

  // Repeat, because an instance accepts more than one prefix and a title can carry a combination
  while (WIP_TITLE_REGEX.test(result)) {
    result = result.replace(WIP_TITLE_REGEX, '');
  }

  return result;
};

/**
 * Check whether the given pull request was opened from a branch of the configured repository rather
 * than from a fork. The repository IDs are compared rather than the repositories themselves,
 * because the instance always reports them — the head repository is left out of the response when
 * it has been deleted — and the head’s is `-1` until one is resolved, so a pull request whose
 * origin can’t be established is treated as a fork.
 * @param {Record<string, any>} item Pull request.
 * @returns {boolean} `true` if the head branch is on the configured repository.
 */
export const isSameRepositoryPullRequest = ({ head, base }) =>
  typeof head?.repo_id === 'number' && head.repo_id !== -1 && head.repo_id === base?.repo_id;

/**
 * Parse a pull request returned by the REST API.
 * @param {Record<string, any>} item Pull request.
 * @returns {WorkflowPullRequest | undefined} Parsed pull request, or `undefined` if the pull
 * request is not managed by the CMS.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetPullRequest
 */
export const parsePullRequest = (item) => {
  const status = getStatusFromLabels(
    (item.labels ?? []).map((/** @type {any} */ { name }) => name),
  );

  if (!status) {
    return undefined;
  }

  const { ref: branch, sha: headSHA } = item.head ?? {};

  // A pull request from a fork has its branch in a repository this flow can’t read. Labelling one
  // by hand would otherwise put a card on the board showing the configured repository’s branch of
  // the same name, and publishing it would merge the fork’s commits — whatever they touch — rather
  // than the entry the reviewer saw
  if (!branch || !isSameRepositoryPullRequest(item)) {
    return undefined;
  }

  // A pull request to a branch other than the configured one isn’t the CMS’s either, whatever label
  // it carries: one whose base branch was changed on the instance after the CMS opened it, or one
  // labelled by hand. Listing it would put a card on the board that moves the label on someone
  // else’s request, and publishes the entry by merging it into that other branch
  if (item.base?.ref !== repository.branch) {
    return undefined;
  }

  const { full_name: fullName, login, email, id } = item.user ?? {};

  return {
    number: item.number,
    nodeId: String(item.id),
    title: stripWipPrefix(item.title),
    url: item.html_url,
    branch,
    headSHA,
    status,
    createdDate: new Date(item.created_at),
    updatedDate: new Date(item.updated_at),
    author: login ? { name: fullName || login, email: email ?? '', id, login } : undefined,
    files: [],
  };
};

/**
 * Fetch the commit the given pull request was last updated to, which is the commit it was merged
 * at once it has been. The pull request itself can’t be asked: the head commit it reports is the
 * branch’s current one for as long as the branch exists, on Forgejo and on a single pull request
 * on Gitea alike, which says nothing about what has been committed since the merge. The instance
 * keeps the commit in a `refs/pull/{number}/head` reference on the configured repository instead,
 * which it stops updating once the pull request is closed or merged.
 * @param {number} number Pull request number.
 * @returns {Promise<string | undefined>} Git object ID, or `undefined` if the reference is
 * missing.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetGitRef
 */
export const fetchPullRequestHeadRef = async (number) => {
  const { owner, repo } = repository;
  const ref = `refs/pull/${number}/head`;

  try {
    const result = /** @type {Record<string, any> | Record<string, any>[]} */ (
      await fetchAPI(`/repos/${owner}/${repo}/git/${ref}`)
    );

    // The path is a prefix filter, which the instance answers with a list even when a single
    // reference matches it exactly, so the one asked for is picked out
    const match = (Array.isArray(result) ? result : [result]).find((item) => item.ref === ref);

    return match?.object?.sha;
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status === 404) {
      return undefined;
    }

    throw ex;
  }
};

/**
 * How many times, and how often, the changed files are read while the instance catches up with the
 * branch. It works out the files from a `refs/pull/{number}/head` reference it moves to the branch
 * head in the background once a commit is pushed, so a list read right after a save can still
 * describe the commit before it.
 */
const FILE_LIST_POLL = { attempts: 10, interval: 1000 };
/**
 * How many times the changed files are read for the board, which only waits a moment for the
 * reference to catch up. A list that still describes another commit then is shown as of that
 * commit: see {@link fetchPullRequestFileList}.
 */
const BOARD_FILE_LIST_ATTEMPTS = 3;

/**
 * Get the commit the given changed file was listed at, which the instance spells out in the file’s
 * API link as the `ref` it’s read at.
 * @param {Record<string, any>} file Changed file returned by the REST API.
 * @returns {string | null} Git object ID, or `null` if the link doesn’t name one.
 */
const getListedCommit = ({ contents_url: url }) => {
  try {
    return new URL(url).searchParams.get('ref');
  } catch {
    return null;
  }
};

/**
 * Fetch the files the given pull request changes as of the given commit. The instance lists them
 * as of the commit its `refs/pull/{number}/head` reference points at, and names that commit in each
 * file’s link; an empty list names none, so the reference itself is read then. A list that turns
 * out to describe another commit is read again until the reference has caught up with the branch.
 * If it doesn’t, the list can’t vouch for the commit, and is reported as incomplete.
 * @param {number} number Pull request number.
 * @param {string} headSHA Git object ID of the commit.
 * @param {number} [attemptsLeft] Remaining reads, including this one.
 * @returns {Promise<{ files: Record<string, any>[], complete: boolean, commit?: string }>} Files,
 * whether they are every file changed as of the commit, and the commit they were listed at, if
 * they name a single one.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetPullRequestFiles
 */
export const fetchChangedFiles = async (
  number,
  headSHA,
  attemptsLeft = FILE_LIST_POLL.attempts,
) => {
  const { owner, repo } = repository;
  const { items, complete } = await fetchPages(`/repos/${owner}/${repo}/pulls/${number}/files`);

  const listedCommits = items.length
    ? [...new Set(items.map((file) => getListedCommit(file)))]
    : [await fetchPullRequestHeadRef(number)];

  // The single commit every file was listed at, if they agree on one
  const commit = listedCommits.length === 1 ? (listedCommits[0] ?? undefined) : undefined;
  const current = commit === headSHA;

  if (current || attemptsLeft <= 1) {
    return { files: items, complete: complete && current, commit };
  }

  await sleep(FILE_LIST_POLL.interval);

  return fetchChangedFiles(number, headSHA, attemptsLeft - 1);
};

/**
 * Fetch the list of files changed in the given pull request as of its head commit, the one a
 * publish is pinned to: see {@link fetchChangedFiles}. Otherwise a file the head commit adds — an
 * asset, say, which the check before publishing lets through as one of the entry’s — could be
 * missing from the board while the instance catches up with a push. A list that still describes
 * another commit once the wait has run out makes that commit the head on record, so the files are
 * read at it as well and the board shows one commit throughout; publishing it is then refused, as
 * the branch has moved on from it, until the board is reloaded. A list that names no single commit
 * leaves no head on record, which publishing refuses just the same.
 * @param {WorkflowPullRequest} pullRequest Pull request to complete.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetPullRequestFiles
 */
export const fetchPullRequestFileList = async (pullRequest) => {
  const { owner, repo } = repository;
  const { number, headSHA } = /** @type {{ number: number, headSHA?: string }} */ (pullRequest);
  /** @type {Record<string, any>[]} */
  let files;

  if (headSHA) {
    const result = await fetchChangedFiles(number, headSHA, BOARD_FILE_LIST_ATTEMPTS);

    files = result.files;
    pullRequest.headSHA = result.commit;
  } else {
    files = await fetchAllPages(`/repos/${owner}/${repo}/pulls/${number}/files`);
  }

  pullRequest.files = files.map(({ filename, status, previous_filename: previousPath }) => ({
    path: filename,
    sha: '',
    size: 0,
    deleted: status === 'deleted',
    previousPath: previousPath || undefined,
  }));
};

/**
 * Decode the Base64-encoded content of a file as UTF-8 text. Neither Gitea nor Forgejo reports
 * whether a blob is binary, so the decoding itself is the test: an image committed along with the
 * entry simply isn’t valid UTF-8.
 * @param {string} content Base64-encoded content.
 * @returns {string | undefined} Decoded text, or `undefined` if the file is binary.
 */
export const decodeFileText = (content) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.fromBase64(content));
  } catch {
    return undefined;
  }
};

/**
 * Fetch the content of a single file changed in the given pull request, and populate the
 * {@link WorkflowFile} object in place.
 * @param {WorkflowPullRequest} pullRequest Pull request the file belongs to.
 * @param {WorkflowFile} file File to complete.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContents
 */
export const fetchPullRequestFileContent = async (pullRequest, file) => {
  // A workflow branch lives in the contributor’s fork with Open Authoring, so that’s where the file
  // has to be read from. It’s read at the head commit rather than the branch, so the content shown
  // is that of the commit a publish is pinned to, even if the branch moves on while the board loads
  const { owner, repo } = getWorkflowRepository();
  const { path } = file;
  const ref = pullRequest.headSHA ?? pullRequest.branch;
  /** @type {Record<string, any>} */
  let result;

  try {
    result = /** @type {Record<string, any>} */ (
      await fetchAPI(
        `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      )
    );
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status !== 404) {
      throw ex;
    }

    // The file may have been removed from the branch in the meantime
    file.deleted = true;

    return;
  }

  const { sha, size, content, encoding } = result;

  Object.assign(file, {
    sha: sha ?? '',
    size: Number(size) || 0,
    text: content && encoding === 'base64' ? decodeFileText(content) : undefined,
  });

  // An instance omits the content of an oversized blob, and keeping that empty would wipe the file
  // the next time the entry is saved. Only a text file is worth reading again; the media that make
  // up most of the oversized blobs have no text to store anyway
  if (!content && file.size && isTextFileType(mime.getType(path) ?? '')) {
    file.text = await fetchRawFile(path, ref);
  }
};

/**
 * Fetch the content of the files changed in the given pull request. Binary files, such as images,
 * have no text, so only their blob metadata is stored.
 * @param {WorkflowPullRequest} pullRequest Pull request to complete.
 */
export const fetchPullRequestFileContents = async (pullRequest) => {
  await runConcurrently(
    pullRequest.files.filter(({ deleted }) => !deleted),
    async (file) => fetchPullRequestFileContent(pullRequest, file),
  );
};

/**
 * Fetch the commit the given workflow branch points at. Two editors working on the same entry
 * share its branch, so this is how a save finds out that someone else has committed to it since
 * the draft was opened. The branch is looked up in the repository it lives in, which is the
 * contributor’s fork with Open Authoring.
 * @param {string} branch Branch name.
 * @returns {Promise<string | undefined>} Git object ID, or `undefined` if the branch is gone,
 * which is what a merged or closed pull request leaves behind.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetBranch
 */
export const fetchBranchHead = async (branch) => {
  const { owner, repo } = getWorkflowRepository();

  try {
    const { commit } = /** @type {{ commit?: { id?: string } }} */ (
      await fetchAPI(`/repos/${owner}/${repo}/branches/${encodePath(branch)}`)
    );

    return commit?.id;
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status === 404) {
      return undefined;
    }

    throw ex;
  }
};

/**
 * Delete the given branch. Failures are ignored, as the branch may already have been deleted when
 * the pull request was merged.
 * @param {string} branch Branch name.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoDeleteBranch
 */
export const deleteBranch = async (branch) => {
  const { owner, repo } = getWorkflowRepository();

  await deleteRemoteBranch({
    branch,
    path: `/repos/${owner}/${repo}/branches/${encodePath(branch)}`,
    goneStatuses: [404],
  });
};

/**
 * Create the label for the given status on the repository. Unlike GitHub and GitLab, Gitea/Forgejo
 * silently drops a label name that doesn’t exist yet instead of creating it on the fly.
 * @param {WorkflowStatus} status Status.
 * @see https://docs.gitea.com/api/next/#tag/issue/operation/issueCreateLabel
 */
export const createStatusLabel = async (status) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    body: {
      name: getStatusLabel(status),
      color: STATUS_LABEL_COLORS[status],
      description: STATUS_LABEL_DESCRIPTION,
    },
  });
};

/**
 * Apply the given labels to a pull request, creating the status label on the repository if it turns
 * out to be missing. The label list the request returns is what the instance actually stored, so a
 * dropped status label is detected there rather than with a lookup before every update. A label of
 * the same name defined by the organization that owns the repository is applied too, but it doesn’t
 * count: the pull requests are listed by the IDs of the repository’s own labels, which is all the
 * CMS can read. An organization label’s API link points under `/orgs/`, which tells it apart.
 * @param {number} number Pull request number.
 * @param {string[]} labels Label names to apply.
 * @param {WorkflowStatus} status Status the labels represent.
 * @param {'POST' | 'PUT'} method `POST` to add the labels, `PUT` to replace the whole list.
 * @see https://docs.gitea.com/api/next/#tag/issue/operation/issueAddLabel
 * @see https://docs.gitea.com/api/next/#tag/issue/operation/issueReplaceLabels
 */
export const applyLabels = async (number, labels, status, method) => {
  const { owner, repo } = repository;
  const path = `/repos/${owner}/${repo}/issues/${number}/labels`;
  const statusLabel = getStatusLabel(status);

  const result = /** @type {Record<string, any>[]} */ (
    await fetchAPI(path, { method, body: { labels } })
  );

  const applied = result.some(
    ({ name, url }) => name === statusLabel && !String(url ?? '').includes('/api/v1/orgs/'),
  );

  if (!applied) {
    await createStatusLabel(status);
    await fetchAPI(path, { method, body: { labels } });
  }
};

/**
 * Replace the CMS-managed status label on a pull request while preserving any other label.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @see https://docs.gitea.com/api/next/#tag/issue/operation/issueGetLabels
 */
export const updateLabels = async (pullRequest, status) => {
  const { owner, repo } = repository;
  const { number } = pullRequest;
  const cmsLabels = getAllStatusLabels();

  const labels = /** @type {Record<string, any>[]} */ (
    await fetchAPI(`/repos/${owner}/${repo}/issues/${number}/labels`)
  );

  const newLabels = [
    ...labels.map(({ name }) => name).filter((name) => !cmsLabels.includes(name)),
    getStatusLabel(status),
  ];

  await applyLabels(/** @type {number} */ (number), newLabels, status, 'PUT');
};

/**
 * Convert a pull request to a draft, or mark it ready for review. There’s no API field for the
 * draft state, which is derived from the title, so the title is rewritten instead.
 * @param {WorkflowPullRequest} pullRequest Pull request. Its title is the one without a prefix.
 * @param {boolean} isDraft Whether the pull request should be a draft.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoEditPullRequest
 */
export const updateDraftState = async (pullRequest, isDraft) => {
  const { owner, repo } = repository;
  const { number, title } = pullRequest;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}`, {
    method: 'PATCH',
    body: { title: isDraft ? `${WIP_TITLE_PREFIX}${title}` : title },
  });
};

/**
 * Create a new pull request for the given workflow branch. The pull request is created as a draft
 * when a newly saved entry starts with the `draft` status.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.title Pull request title.
 * @param {WorkflowStatus} args.status Status to open the pull request with.
 * @returns {Promise<WorkflowPullRequest>} Created pull request.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoCreatePullRequest
 */
export const createPullRequest = async ({ branch, title, status }) => {
  const { owner, repo, branch: baseBranch } = repository;
  const fork = forkedRepository.current;
  const isDraft = status === 'draft';

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: {
        title: isDraft ? `${WIP_TITLE_PREFIX}${title}` : title,
        // A cross-repository pull request identifies its head branch by the fork’s owner
        head: fork ? `${fork.owner}:${branch}` : branch,
        base: baseBranch,
        body: 'Automatically generated by Sveltia CMS',
      },
    })
  );

  // Labelling a pull request requires write access to the repository, which an Open Authoring
  // contributor doesn’t have. Their status is read from the pull request itself instead
  if (!fork) {
    // The label can’t be set on creation, which takes label IDs rather than names. A brand-new pull
    // request has no label to preserve, so the status label is added outright rather than replacing
    // the current list like {@link updateLabels} has to
    await applyLabels(result.number, [getStatusLabel(status)], status, 'POST');
  }

  return {
    number: result.number,
    nodeId: String(result.id),
    title,
    url: result.html_url,
    branch,
    headSHA: result.head?.sha,
    status,
    createdDate: new Date(result.created_at),
    updatedDate: new Date(result.updated_at),
    files: [],
  };
};

/**
 * Get the path a change reads the current file from, which is the path it came from when the change
 * renames the entry.
 * @param {FileChange} change Change to be committed.
 * @returns {string} File path.
 */
const getSourcePath = ({ action, path, previousPath }) =>
  action === 'move' && previousPath ? previousPath : path;

/**
 * Fetch the blob SHA of the given file on the given branch or commit.
 * @param {string} path File path.
 * @param {string} ref Branch or commit to read the file from.
 * @param {RepositoryPath} [repository] Repository to read the file from. Defaults to the one the
 * workflow branches live in, which is the contributor’s fork with Open Authoring.
 * @returns {Promise<string | undefined>} Blob SHA, or `undefined` if the file isn’t there.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContents
 */
export const fetchFileSHA = async (path, ref, { owner, repo } = getWorkflowRepository()) => {
  try {
    const { sha } = /** @type {Record<string, any>} */ (
      await fetchAPI(
        `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      )
    );

    return sha;
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status !== 404) {
      throw ex;
    }

    return undefined;
  }
};

/**
 * Fill in the blob SHA that each change needs on the branch it lands on. Gitea/Forgejo refuses a
 * commit that updates, moves or deletes a file without the file’s current SHA, and refuses it just
 * as firmly when the SHA is out of date. The CMS’s file cache holds the SHAs on the configured
 * branch, which a workflow branch has moved on from with every earlier save, so they’re read from
 * the branch the commit is about to land on. A save touches a handful of files, and only the ones
 * it doesn’t create need looking up.
 *
 * A file the branch turns out not to have can’t be updated, moved or deleted there, whatever the
 * cache says. That’s what an Open Authoring fork looks like once it has fallen behind: the entry
 * the contributor is editing was added upstream after they forked. The change is reshaped to what
 * the branch can take — writing the file is a creation there, and removing it is nothing at all.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {string} ref Branch the changes land on, or the commit the branch is expected to point
 * at.
 * @returns {Promise<FileChange[]>} Changes, with the SHA of each existing file filled in.
 */
export const resolveChangeSHAs = async (changes, ref) => {
  const paths = unique(
    changes.filter(({ action }) => action !== 'create').map((change) => getSourcePath(change)),
  );

  if (!paths.length) {
    return changes;
  }

  /** @type {Map<string, string>} */
  const shaMap = new Map();

  await runConcurrently(paths, async (path) => {
    const sha = await fetchFileSHA(path, ref);

    if (sha) {
      shaMap.set(path, sha);
    }
  });

  return changes.flatMap((change) => {
    if (change.action === 'create') {
      return change;
    }

    const sha = shaMap.get(getSourcePath(change));

    if (sha) {
      return { ...change, previousSha: sha };
    }

    if (change.action === 'delete') {
      return [];
    }

    const { previousPath: _previousPath, previousSha: _previousSha, ...rest } = change;

    return { ...rest, action: 'create' };
  });
};
