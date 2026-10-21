import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { pollUntil, SETTLE_POLL } from '$lib/services/backends/git/shared/poll';
import { waitForMerge } from '$lib/services/backends/git/shared/workflow';

/**
 * @import { WorkflowPullRequest } from '$lib/types/private';
 */

/**
 * Rollup states of a commit’s checks under which a pull request set to auto-merge is still expected
 * to merge on its own: a check is running, or hasn’t reported yet.
 * @see https://docs.github.com/en/graphql/reference/enums#statusstate
 */
const PENDING_CHECK_STATES = ['PENDING', 'EXPECTED'];
/**
 * Review decisions that stop a pull request from being merged whatever its checks say, so
 * auto-merge would wait for a review rather than for the checks.
 * @see https://docs.github.com/en/graphql/reference/enums#pullrequestreviewdecision
 */
const BLOCKING_REVIEW_DECISIONS = ['REVIEW_REQUIRED', 'CHANGES_REQUESTED'];
/**
 * Merge states under which GitHub merges a pull request right away. `UNSTABLE` means a check that
 * isn’t required has failed, which doesn’t stop the merge.
 * @see https://docs.github.com/en/graphql/reference/enums#mergestatestatus
 */
const MERGEABLE_STATES = ['CLEAN', 'HAS_HOOKS', 'UNSTABLE'];
/**
 * How many times, and how often, the pull request is read while GitHub works out whether it can be
 * merged. GitHub does that in the background after a push, which usually takes a second or two,
 * and reports `UNKNOWN` meanwhile.
 * @see https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
const MERGE_STATE_POLL = SETTLE_POLL;

/**
 * Query to fetch what tells a pull request GitHub can merge once its required checks pass from one
 * it won’t merge at all.
 * @see https://docs.github.com/en/graphql/reference/objects#pullrequest
 */
const FETCH_MERGE_READINESS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        state
        merged
        mergeStateStatus
        reviewDecision
        viewerCanEnableAutoMerge
        autoMergeRequest {
          enabledAt
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
`;

const ENABLE_AUTO_MERGE_MUTATION = `
  mutation($input: EnablePullRequestAutoMergeInput!) {
    enablePullRequestAutoMerge(input: $input) {
      clientMutationId
    }
  }
`;

const DISABLE_AUTO_MERGE_MUTATION = `
  mutation($input: DisablePullRequestAutoMergeInput!) {
    disablePullRequestAutoMerge(input: $input) {
      clientMutationId
    }
  }
`;

/**
 * Read the pull request’s merge state over the GraphQL API, which, unlike the REST API, tells a
 * required check still running from any other reason GitHub has to refuse a merge.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<Record<string, any> | undefined>} Pull request node, with the rollup state of
 * its head commit’s checks as `checkState`, or `undefined` if it’s not found.
 */
const fetchMergeReadiness = async (pullRequest) => {
  const { owner, repo } = repository;

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(FETCH_MERGE_READINESS_QUERY, { owner, repo, number: pullRequest.number })
  );

  const node = result?.pullRequest;

  if (!node) {
    return undefined;
  }

  return { ...node, checkState: node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state };
};

/**
 * Check whether GitHub is still working out if an open pull request can be merged.
 * @param {Record<string, any> | undefined} node Pull request node from {@link fetchMergeReadiness}.
 * @returns {boolean} Result.
 */
const isCheckingMergeability = (node) =>
  node?.state === 'OPEN' && node.mergeStateStatus === 'UNKNOWN';

/**
 * Read the pull request’s merge state with {@link fetchMergeReadiness}, again and again while
 * GitHub is still working out whether it can be merged, until that settles or the attempts run
 * out, in which case the unsettled state is returned as is.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<Record<string, any> | undefined>} Pull request node, or `undefined` if it’s not
 * found.
 */
const fetchSettledMergeReadiness = (pullRequest) =>
  pollUntil(
    () => fetchMergeReadiness(pullRequest),
    (node) => !isCheckingMergeability(node),
    MERGE_STATE_POLL,
  );

/**
 * Check whether a pull request GitHub refused to merge is only waiting for its required checks, so
 * it can be set to auto-merge. A pull request also blocked by something else — a failed check, a
 * review still required, a conflict — would sit there unmerged while the CMS waits for it, so it’s
 * left as a refusal. The same goes for a repository that doesn’t allow auto-merge.
 * @param {Record<string, any>} node Pull request node from {@link fetchMergeReadiness}.
 * @returns {boolean} Result.
 */
const isWaitingForChecks = (node) =>
  node.state === 'OPEN' &&
  node.mergeStateStatus === 'BLOCKED' &&
  // GitHub doesn’t offer to enable an auto-merge that’s already on, e.g. one set by an earlier
  // publish whose wait was cut short by closing the page
  (!!node.viewerCanEnableAutoMerge || !!node.autoMergeRequest) &&
  PENDING_CHECK_STATES.includes(node.checkState) &&
  !BLOCKING_REVIEW_DECISIONS.includes(node.reviewDecision);

/**
 * Cancel the auto-merge on the given pull request. Failures are ignored: this is called once the
 * publish is being reported as failed, and a pull request that has just been merged or closed has
 * no auto-merge left to cancel.
 * @param {string} nodeId Pull request node ID.
 * @param {number} number Pull request number.
 * @see https://docs.github.com/en/graphql/reference/mutations#disablepullrequestautomerge
 */
const cancelAutoMerge = async (nodeId, number) => {
  try {
    await fetchGraphQL(DISABLE_AUTO_MERGE_MUTATION, { input: { pullRequestId: nodeId } });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to cancel the auto-merge on pull request #${number}.`, ex);
  }
};

/**
 * Wait for GitHub to merge a pull request that has been set to auto-merge. The pull request is read
 * every so often until it’s merged, in which case this resolves, or until it’s clear that the merge
 * won’t happen on its own: a check has failed, a new commit or someone on GitHub has cancelled the
 * auto-merge, the pull request has been closed, or the wait has run out. Those are reported as
 * errors, so the entry stays on the Editorial Workflow board rather than being taken for
 * published. GitHub keeps the auto-merge armed after a failed check, in case it’s re-run by hand,
 * but a merge made that way would happen behind the CMS’s back once it has reported a failure, so
 * the auto-merge is cancelled along with the report: publishing again is what merges the entry from
 * then on.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {string} nodeId Pull request node ID.
 * @returns {Promise<void>}
 * @throws {Error} When the pull request won’t be merged, or wasn’t within the time allowed.
 */
const waitForAutoMerge = async (pullRequest, nodeId) => {
  const { number } = pullRequest;

  await waitForMerge({
    /**
     * Read the pull request.
     * @returns {Promise<Record<string, any> | undefined>} Pull request node.
     */
    read: () => fetchMergeReadiness(pullRequest),
    /**
     * Check the pull request read.
     * @param {Record<string, any> | undefined} node Pull request node, or `undefined` if it’s not
     * found.
     * @returns {Promise<boolean>} Whether the pull request has been merged.
     * @throws {Error} When the pull request won’t be merged.
     */
    evaluate: async (node) => {
      if (node?.merged) {
        return true;
      }

      const { state, autoMergeRequest, checkState } = node ?? {};
      const autoMerge = !!autoMergeRequest;
      const failed = !PENDING_CHECK_STATES.includes(checkState) && checkState !== 'SUCCESS';

      if (state !== 'OPEN' || !autoMerge || failed) {
        if (state === 'OPEN' && autoMerge) {
          await cancelAutoMerge(nodeId, /** @type {number} */ (number));
        }

        throw new Error(
          `Pull request #${number} was not merged: ${state}, checks ${checkState}, ` +
            `auto-merge ${autoMerge ? 'on' : 'off'}`,
        );
      }

      return false;
    },
    /**
     * Cancel the auto-merge once the wait has run out.
     * @returns {Promise<void>}
     */
    cancel: () => cancelAutoMerge(nodeId, /** @type {number} */ (number)),
    label: `pull request #${number}`,
  });
};

/**
 * Set a pull request that’s waiting for its required checks to auto-merge, pinned to the commit the
 * entry was loaded or saved at, unless it’s set already.
 * @param {object} args Arguments.
 * @param {WorkflowPullRequest} args.pullRequest Pull request.
 * @param {Record<string, any>} args.node Pull request node from {@link fetchMergeReadiness}.
 * @param {boolean} args.squash Whether to squash the commits.
 * @param {() => Promise<any>} args.merge Function to merge the pull request right away.
 * @returns {Promise<boolean>} Whether GitHub is to merge the pull request once the checks pass,
 * rather than having merged it already.
 */
const scheduleAutoMerge = async ({ pullRequest, node, squash, merge }) => {
  if (node.autoMergeRequest) {
    return true;
  }

  const { title, headSHA } = pullRequest;

  try {
    await fetchGraphQL(ENABLE_AUTO_MERGE_MUTATION, {
      input: {
        pullRequestId: node.id,
        mergeMethod: squash ? 'SQUASH' : 'MERGE',
        commitHeadline: title,
        ...(headSHA ? { expectedHeadOid: headSHA } : {}),
      },
    });

    return true;
  } catch {
    // The response can have been lost after GitHub turned auto-merge on, which a merge now would be
    // refused for while the checks run, so the pull request is read again first
    const latest = await fetchMergeReadiness(pullRequest);

    // GitHub may even have merged it by now, which leaves only the branch cleanup to do
    if (latest?.merged) {
      return false;
    }

    if (latest?.autoMergeRequest) {
      return true;
    }

    // Otherwise the checks can have passed since the merge was refused, in which case GitHub
    // refuses auto-merge on a pull request it can merge right away, so it’s merged now instead. A
    // refusal of that is the error to report
    await merge();

    return false;
  }
};

/**
 * Make what can be made of a merge GitHub has refused with a `405 Method Not Allowed`, which it
 * answers whenever the pull request can’t be merged, whatever the reason, so the pull request is
 * read to tell them apart. GitHub refuses the merge while it’s still working out whether the pull
 * request can be merged, which it does in the background after a push, so the pull request is read
 * again until that settles. Branch protection or a ruleset can also require status checks to pass
 * before a pull request is merged, and GitHub refuses an immediate merge while they’re running, in
 * which case the pull request is set to auto-merge, and this resolves once GitHub has merged it.
 * @param {object} args Arguments.
 * @param {WorkflowPullRequest} args.pullRequest Pull request.
 * @param {boolean} args.squash Whether to squash the commits.
 * @param {() => Promise<any>} args.merge Function to merge the pull request right away, pinned to
 * the commit on record.
 * @param {Error} args.refusal Error the merge was refused with, which is thrown again when there’s
 * nothing to be made of it.
 * @returns {Promise<void>} Resolves once the pull request has been merged, leaving the branch
 * cleanup to the caller.
 * @throws {Error} When the pull request won’t be merged.
 * @see https://docs.github.com/en/graphql/reference/mutations#enablepullrequestautomerge
 * @see https://github.com/sveltia/sveltia-cms/issues/1094
 */
export const mergeRefusedPullRequest = async ({ pullRequest, squash, merge, refusal }) => {
  const node = await fetchSettledMergeReadiness(pullRequest);

  // It has been merged already — by a maintainer on GitHub while this board was open, say. That’s
  // the outcome the user asked for, so it’s the branch cleanup that’s left to do rather than an
  // error to report
  if (node?.merged) {
    return;
  }

  if (isCheckingMergeability(node)) {
    throw new Error(
      `Timed out waiting for GitHub to check whether pull request #${pullRequest.number} can be ` +
        'merged',
      { cause: refusal },
    );
  }

  // What held the merge back may have passed by the time the state settles, such as the
  // mergeability check GitHub runs after a push. The merge is then made once more, pinned to the
  // same commit, so a push made since can’t slip in
  if (MERGEABLE_STATES.includes(node?.mergeStateStatus)) {
    await merge();
  } else if (node && isWaitingForChecks(node)) {
    if (await scheduleAutoMerge({ pullRequest, node, squash, merge })) {
      await waitForAutoMerge(pullRequest, node.id);
    }
  } else {
    throw refusal;
  }
};
