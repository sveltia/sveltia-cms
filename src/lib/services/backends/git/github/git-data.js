import { sleep } from '@sveltia/utils/misc';

import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { mapConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { getGitHash } from '$lib/services/utils/file';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { AdditionsCommitAuthor } from '$lib/types/private';
 * @import { FileAddition } from '$lib/services/backends/git/shared/commit-split';
 */

/**
 * Number of blobs created at the same time. Creating content counts against GitHub’s secondary rate
 * limit of 80 requests a minute, so a save with many images goes slowly rather than all at once.
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits
 */
const BLOB_CONCURRENCY = 3;

/**
 * How long to wait before each retry of a request refused by the secondary rate limit. GitHub asks
 * for at least a minute when it doesn’t say how long.
 */
export const RATE_LIMIT_DELAYS = [15_000, 30_000, 60_000];

/**
 * Check whether an error comes from GitHub’s secondary rate limit, which it reports with a 403 or
 * 429 status.
 * @param {any} error Error thrown by `fetchAPI`.
 * @returns {boolean} Result.
 */
const isRateLimited = (error) => {
  const { status, message } = error?.cause ?? {};

  return status === 429 || (status === 403 && /rate limit/i.test(String(message)));
};

/**
 * Send a request, waiting and trying again when the secondary rate limit refuses it.
 * @param {() => Promise<any>} request Request.
 * @returns {Promise<any>} Response.
 * @throws {Error} When the request fails for another reason, or keeps being refused.
 */
const sendWithBackoff = async (request) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await request();
    } catch (ex) {
      if (!isRateLimited(ex) || attempt >= RATE_LIMIT_DELAYS.length) {
        throw ex;
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(RATE_LIMIT_DELAYS[attempt]);
    }
  }
};

/**
 * Check whether a file goes into the tree as text, which saves a request for its blob. Only entry
 * files and other text are passed as strings; assets come as `Blob`s.
 * @param {FileAddition} addition File addition.
 * @returns {boolean} Result.
 */
const isText = ({ data }) => typeof data === 'string' || data === undefined;

/**
 * Commit the given additions and deletions on top of the given head through the REST Git Data API,
 * which, unlike GraphQL’s `createCommitOnBranch`, takes an author. That lets someone without a
 * GitHub account be the author of their changes, while an app’s installation token makes the
 * requests. GitHub doesn’t sign such a commit. The branch is moved only if the commit is a
 * fast-forward, so a commit someone else has pushed in the meantime isn’t overwritten, just like
 * with `expectedHeadOid`.
 * @param {object} args Arguments.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} args.branch Branch name.
 * @param {string} args.expectedHeadOid Commit the new commit has to go on top of.
 * @param {FileAddition[]} args.additions File additions.
 * @param {{ path: string }[]} args.deletions File deletions.
 * @param {string} args.message Commit message.
 * @param {AdditionsCommitAuthor} args.author Author, who is the committer as well.
 * @returns {Promise<Record<string, any>>} Commit, in the shape the GraphQL path returns: the SHA as
 * `oid`, the date as `committedDate`, and the file SHAs aliased as `file_{index}`.
 * @see https://docs.github.com/en/rest/git
 */
export const createGitDataCommit = async ({
  owner,
  repo,
  branch,
  expectedHeadOid,
  additions,
  deletions,
  message,
  author,
}) => {
  const base = `/repos/${owner}/${repo}/git`;
  const addedPaths = new Set(additions.map(({ path }) => path));
  const binaryAdditions = additions.filter((addition) => !isText(addition));

  const [baseCommit, blobShas, fileShas] = await Promise.all([
    /** @type {Promise<{ tree: { sha: string } }>} */ (
      fetchAPI(`${base}/commits/${expectedHeadOid}`)
    ),
    mapConcurrently(
      binaryAdditions,
      async ({ contents }) =>
        /** @type {{ sha: string }} */ (
          await sendWithBackoff(() =>
            fetchAPI(`${base}/blobs`, {
              method: 'POST',
              body: { content: contents, encoding: 'base64' },
            }),
          )
        ).sha,
      { concurrency: BLOB_CONCURRENCY },
    ),
    // The tree lists the files at the top level only, so the SHAs are worked out here instead
    Promise.all(additions.map(({ data }) => getGitHash(data ?? ''))),
  ]);

  const tree = [
    ...additions.map((addition) =>
      isText(addition)
        ? { path: addition.path, mode: '100644', type: 'blob', content: addition.data ?? '' }
        : {
            path: addition.path,
            mode: '100644',
            type: 'blob',
            sha: blobShas[binaryAdditions.indexOf(addition)],
          },
    ),
    // A file deleted and added again at the same path is just updated
    ...deletions
      .filter(({ path }) => !addedPaths.has(path))
      .map(({ path }) => ({ path, mode: '100644', type: 'blob', sha: null })),
  ];

  /** @type {{ sha: string }} */
  const { sha: treeSha } = /** @type {any} */ (
    await fetchAPI(`${base}/trees`, {
      method: 'POST',
      body: { base_tree: baseCommit.tree.sha, tree },
    })
  );

  const signature = { name: author.name, email: author.email, date: new Date().toISOString() };

  /** @type {{ sha: string, committer: { date: string } }} */
  const commit = /** @type {any} */ (
    await fetchAPI(`${base}/commits`, {
      method: 'POST',
      body: {
        message,
        tree: treeSha,
        parents: [expectedHeadOid],
        author: signature,
        committer: signature,
      },
    })
  );

  // Without `force`, GitHub refuses to move the branch unless it still points to the parent
  await fetchAPI(`${base}/refs/heads/${encodePathSegments(branch)}`, {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  });

  return {
    oid: commit.sha,
    committedDate: commit.committer.date,
    ...Object.fromEntries(additions.map(({ index }, i) => [`file_${index}`, { oid: fileShas[i] }])),
  };
};
