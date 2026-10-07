import { getBlobSHA, MockGitRepository } from './git.js';

/**
 * @import { Page, Route } from '@playwright/test';
 * @import { MockCommit, MockResponse, MockUser } from './git.js';
 */

/**
 * @typedef {object} MockMergeRequest
 * @property {number} iid Merge request number in the project.
 * @property {number} id Global ID.
 * @property {string} title Title, with a `Draft: ` prefix for a draft.
 * @property {string} sourceBranch Branch the changes come from.
 * @property {string} targetBranch Branch the changes go to.
 * @property {string[]} labels Label names.
 * @property {'opened' | 'closed' | 'merged'} state State.
 * @property {MockUser} author Author.
 * @property {Date} createdAt Creation date.
 * @property {Date} updatedAt Last update date.
 * @property {string} [lastHead] Head of the source branch when the merge request was closed or
 * merged, which stays known after the branch is deleted.
 * @property {string} [mergeCommit] SHA of the commit that merged the merge request.
 * @property {Record<string, any>} [autoMerge] The merge options, once the merge request is set to
 * be merged when its pipeline succeeds.
 */

/**
 * Root of the mocked REST API, the default of the `gitlab` backend.
 */
export const GITLAB_API_ROOT = 'https://gitlab.com/api/v4';

/**
 * URL of the mocked GraphQL API.
 */
export const GITLAB_GRAPHQL_URL = 'https://gitlab.com/api/graphql';

/**
 * URL the CMS checks the status of GitLab.com at.
 */
const STATUS_URL = 'https://status-api.hostedstatus.com/**';

/**
 * A GitLab project behind a mocked REST and GraphQL API, for the CMS to sign in to, load files from
 * and commit to. A test can commit to it as someone else with {@link MockGitLab.commit} to simulate
 * a colleague’s change, and check the bodies of the commit requests the CMS sent in
 * {@link MockGitLab.received}.
 */
export class MockGitLab extends MockGitRepository {
  /**
   * Root of the REST API: GitLab.com’s, or a self-managed instance’s like
   * `https://gitlab.example.com/api/v4`. Set it before the page is opened.
   */
  apiRoot = GITLAB_API_ROOT;

  /**
   * URL of the GraphQL API, e.g. `https://gitlab.example.com/api/graphql`.
   */
  graphqlURL = GITLAB_GRAPHQL_URL;

  /**
   * Whether the signed-in user can push code to the project. A user who can’t is refused.
   */
  canWrite = true;

  /**
   * Whether the signed-in user can push to the configured branch, which a protected branch can
   * forbid.
   */
  canPush = true;

  /**
   * Maximum number of files in a page of the file list, which GitLab limits to 100.
   */
  treePageSize = 100;

  /**
   * Merge requests, open or not, the oldest first.
   * @type {MockMergeRequest[]}
   */
  mergeRequests = [];

  /**
   * Builds reported for each commit with {@link reportBuild}, keyed by commit SHA.
   * @type {Map<string, { deployments: Record<string, any>[], statuses: Record<string, any>[] }>}
   */
  builds = new Map();

  /**
   * Whether a pipeline is running for the merge requests. Until it succeeds, a merge request can’t
   * be merged, but it can be set to be merged then; {@link finishPipeline} lets it succeed.
   */
  pipelineRunning = false;

  /**
   * Overall status code of GitLab.com as its status page reports it: `100` when all is well, `200`
   * to `400` for a minor incident and `500` or `600` for a major one.
   */
  statusCode = 100;

  /**
   * Path of the project in the REST API, as the CMS encodes it.
   * @type {string}
   */
  get projectPath() {
    return `/projects/${encodeURIComponent(`${this.owner}/${this.repo}`)}`;
  }

  /**
   * Report the builds of a commit: a deployment to an environment, like a Review App, or a commit
   * status posted by an external CI/CD service. A later report replaces the earlier ones.
   * @param {string} sha Commit SHA.
   * @param {object} builds Builds.
   * @param {{ environment: string, status: string, url?: string }[]} [builds.deployments]
   * Deployments, with a status like `running`, `success` or `failed`.
   * @param {{ name: string, status: string, target_url?: string, description?: string }[]}
   * [builds.statuses] Commit statuses, with a status like `running` or `success`.
   */
  reportBuild(sha, { deployments = [], statuses = [] }) {
    this.builds.set(sha, { deployments, statuses });
  }

  /**
   * Open a merge request, as the CMS or a colleague does.
   * @param {object} args Arguments.
   * @param {string} args.title Title, with a `Draft: ` prefix for a draft.
   * @param {string} args.sourceBranch Branch the changes come from.
   * @param {string} [args.targetBranch] Branch the changes go to, the default branch by default.
   * @param {string[]} [args.labels] Label names.
   * @param {MockUser} [args.author] Author, the colleague by default.
   * @returns {MockMergeRequest} Merge request.
   */
  openMergeRequest({
    title,
    sourceBranch,
    targetBranch = this.branch,
    labels = [],
    author = this.colleague,
  }) {
    const now = new Date();

    /** @type {MockMergeRequest} */
    const mergeRequest = {
      iid: this.mergeRequests.length + 1,
      id: 1000 + this.mergeRequests.length + 1,
      title,
      sourceBranch,
      targetBranch,
      labels: [...labels],
      state: 'opened',
      author,
      createdAt: now,
      updatedAt: now,
    };

    this.mergeRequests.push(mergeRequest);

    return mergeRequest;
  }

  /**
   * Get the open merge request from a branch to the given target branch. Like GitLab, a merge
   * request to another branch doesn’t count: a source branch can have one open merge request per
   * target branch.
   * @param {string} branch Branch name.
   * @param {string} [target] Target branch name, the default branch by default.
   * @returns {MockMergeRequest | undefined} Merge request.
   */
  getOpenMergeRequest(branch, target = this.branch) {
    return this.mergeRequests.find(
      ({ sourceBranch, targetBranch, state }) =>
        sourceBranch === branch && targetBranch === target && state === 'opened',
    );
  }

  /**
   * Delete a branch. Like GitLab, this closes every open merge request the branch is the source of,
   * whichever branch each one goes to: without its source branch, a merge request has nothing left
   * to merge.
   * @param {string} branch Branch name.
   * @returns {boolean} Whether the branch existed.
   * @see https://docs.gitlab.com/user/project/merge_requests/#delete-the-source-branch
   */
  deleteBranch(branch) {
    this.mergeRequests
      .filter(({ sourceBranch, state }) => sourceBranch === branch && state === 'opened')
      .forEach((mergeRequest) => {
        Object.assign(mergeRequest, {
          state: 'closed',
          lastHead: this.refs.get(branch),
          updatedAt: new Date(),
        });
      });

    return this.refs.delete(branch);
  }

  /**
   * Check whether a merge request can be merged without a conflict, without merging it.
   * @param {MockMergeRequest} mergeRequest Merge request.
   * @returns {boolean} Result.
   */
  canMerge({ sourceBranch, targetBranch }) {
    const head = this.getHead(sourceBranch);
    const baseHead = this.getHead(targetBranch);
    const mergeBase = this.getMergeBase(head.oid, baseHead.oid);

    return MockGitLab.diffTrees(mergeBase.tree, head.tree).every(
      ({ path }) =>
        baseHead.tree.get(path) === mergeBase.tree.get(path) ||
        baseHead.tree.get(path) === head.tree.get(path),
    );
  }

  /**
   * List the files the given commit changes since it parted from the given branch, as diffs.
   * @param {MockCommit} head Commit.
   * @param {string} targetBranch Branch to compare with.
   * @returns {Record<string, any>[]} Diffs.
   */
  diffCommit(head, targetBranch) {
    const mergeBase = this.getMergeBase(head.oid, this.getHead(targetBranch).oid);

    return MockGitLab.diffTrees(mergeBase.tree, head.tree).map(({ path, changeType }) => ({
      old_path: path,
      new_path: path,
      new_file: changeType === 'ADDED',
      deleted_file: changeType === 'DELETED',
      renamed_file: false,
      // Every file in the mock is a regular one
      b_mode: changeType === 'DELETED' ? '0' : '100644',
    }));
  }

  /**
   * Convert a merge request to the format the REST API returns.
   * @param {MockMergeRequest} mergeRequest Merge request.
   * @returns {Record<string, any>} Merge request.
   */
  toMergeRequestItem(mergeRequest) {
    const { iid, id, title, sourceBranch, targetBranch, labels, state, author } = mergeRequest;
    const open = state === 'opened' && this.refs.has(sourceBranch);

    return {
      id,
      iid,
      title,
      state,
      labels,
      source_branch: sourceBranch,
      target_branch: targetBranch,
      source_project_id: 1,
      target_project_id: 1,
      author: { id: author.id, username: author.login, name: author.name },
      sha: open ? this.getHead(sourceBranch).oid : mergeRequest.lastHead,
      web_url: `https://gitlab.com/${this.owner}/${this.repo}/-/merge_requests/${iid}`,
      created_at: mergeRequest.createdAt.toISOString(),
      updated_at: mergeRequest.updatedAt.toISOString(),
      detailed_merge_status: !open
        ? 'not_open'
        : !this.canMerge(mergeRequest)
          ? 'conflict'
          : this.pipelineRunning
            ? 'ci_still_running'
            : 'mergeable',
      merge_when_pipeline_succeeds: !!mergeRequest.autoMerge,
      user: { can_merge: true },
      changes_count: open
        ? String(this.diffCommit(this.getHead(sourceBranch), targetBranch).length)
        : null,
    };
  }

  /**
   * Answer a request about merge requests.
   * @param {string} method HTTP method.
   * @param {string[]} segments URL path segments after `merge_requests`, decoded.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} searchParams URL query.
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleMergeRequestRequest(method, segments, body, searchParams) {
    if (!segments.length) {
      if (method === 'GET') {
        const state = searchParams.get('state');
        const labels = searchParams.get('labels')?.split(',') ?? [];
        const sourceBranch = searchParams.get('source_branch');

        return {
          json: this.mergeRequests
            .filter(
              (mr) =>
                (!state || mr.state === state) &&
                labels.every((label) => mr.labels.includes(label)) &&
                (!sourceBranch || mr.sourceBranch === sourceBranch),
            )
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map((mr) => this.toMergeRequestItem(mr)),
        };
      }

      if (method === 'POST') {
        const {
          title,
          source_branch: sourceBranch,
          target_branch: targetBranch,
          labels = '',
        } = body ?? {};

        // Like GitLab, refuse a second open merge request from the same branch to the same target
        if (this.getOpenMergeRequest(sourceBranch, targetBranch)) {
          return {
            status: 409,
            json: { message: ['Another open merge request already exists for this source branch'] },
          };
        }

        const mergeRequest = this.openMergeRequest({
          title,
          sourceBranch,
          targetBranch,
          labels: labels ? String(labels).split(',') : [],
          author: this.user,
        });

        return { status: 201, json: this.toMergeRequestItem(mergeRequest) };
      }

      return undefined;
    }

    const mergeRequest = this.mergeRequests.find(({ iid }) => iid === Number(segments[0]));

    if (!mergeRequest) {
      return { status: 404, json: { message: '404 Not found' } };
    }

    if (method === 'GET' && segments.length === 1) {
      return { json: this.toMergeRequestItem(mergeRequest) };
    }

    // The files the merge request changes, from where the branches parted
    if (method === 'GET' && segments[1] === 'diffs') {
      return {
        json: this.diffCommit(this.getHead(mergeRequest.sourceBranch), mergeRequest.targetBranch),
      };
    }

    if (method === 'PUT' && segments.length === 1) {
      const { title, add_labels: addLabels, remove_labels: removeLabels } = body ?? {};
      const removed = String(removeLabels ?? '').split(',');

      if (title !== undefined) {
        mergeRequest.title = title;
      }

      if (addLabels || removeLabels) {
        mergeRequest.labels = [
          ...mergeRequest.labels.filter((label) => !removed.includes(label)),
          ...String(addLabels ?? '')
            .split(',')
            .filter((label) => label && !mergeRequest.labels.includes(label)),
        ];
      }

      if (body?.state_event === 'close') {
        Object.assign(mergeRequest, {
          state: 'closed',
          lastHead: this.refs.get(mergeRequest.sourceBranch),
        });
      }

      mergeRequest.updatedAt = new Date();

      return { json: this.toMergeRequestItem(mergeRequest) };
    }

    if (method === 'PUT' && segments[1] === 'merge') {
      return this.handleMerge(mergeRequest, body ?? {});
    }

    return undefined;
  }

  /**
   * Let the running pipeline succeed, which merges the merge requests set to be merged then.
   */
  finishPipeline() {
    this.pipelineRunning = false;
    this.mergeRequests
      .filter(({ state, autoMerge }) => state === 'opened' && autoMerge)
      .forEach((mergeRequest) => {
        this.handleMerge(mergeRequest, /** @type {Record<string, any>} */ (mergeRequest.autoMerge));
      });
  }

  /**
   * Merge a merge request, like GitLab does when asked to through the API. A merge request that
   * can’t be merged right away, because of a conflict or a pipeline still running, is refused with
   * 405 Method Not Allowed, unless it’s set to be merged when the pipeline succeeds, and one whose
   * source branch has moved past the `sha` given with 409 Conflict.
   * @param {MockMergeRequest} mergeRequest Merge request.
   * @param {Record<string, any>} body Request body.
   * @returns {MockResponse} Response.
   */
  handleMerge(mergeRequest, body) {
    const { sha, squash = false, should_remove_source_branch: removeSourceBranch } = body;

    if (mergeRequest.state !== 'opened' || !this.refs.has(mergeRequest.sourceBranch)) {
      return { status: 405, json: { message: '405 Method Not Allowed' } };
    }

    const { oid: headOid } = this.getHead(mergeRequest.sourceBranch);

    if (sha && sha !== headOid) {
      return { status: 409, json: { message: 'SHA does not match HEAD of source branch' } };
    }

    // A merge request whose pipeline is still running can only be set to be merged once it succeeds
    if (this.pipelineRunning && this.canMerge(mergeRequest)) {
      if (!body.auto_merge && !body.merge_when_pipeline_succeeds) {
        return { status: 405, json: { message: '405 Method Not Allowed' } };
      }

      mergeRequest.autoMerge = body;

      return { json: this.toMergeRequestItem(mergeRequest) };
    }

    const commit = this.mergeBranch({
      head: mergeRequest.sourceBranch,
      base: mergeRequest.targetBranch,
      method: squash ? 'squash' : 'merge',
      message: (squash ? body.squash_commit_message : body.merge_commit_message) ?? '',
      author: this.user,
    });

    if (!commit) {
      return { status: 405, json: { message: '405 Method Not Allowed' } };
    }

    Object.assign(mergeRequest, {
      state: 'merged',
      mergeCommit: commit.oid,
      lastHead: headOid,
      updatedAt: new Date(),
    });

    if (removeSourceBranch) {
      this.refs.delete(mergeRequest.sourceBranch);
    }

    return { json: this.toMergeRequestItem(mergeRequest) };
  }

  /**
   * Route the API requests of the pages in a browser context to the mock, including a sign-in
   * popup, and store a session for the user, so the CMS signs in on its own when the page is
   * opened.
   * @param {Page} page Page.
   * @param {object} [options] Options.
   * @param {boolean} [options.signedIn] Whether to store the session.
   */
  async install(page, { signedIn = true } = {}) {
    const context = page.context();

    if (signedIn) {
      await this.storeSession(page, 'gitlab');
    }

    await context.route(
      (url) => url.href.startsWith(`${this.apiRoot}/`),
      (route) => this.handleRoute(route),
    );
    await context.route(
      (url) => `${url.origin}${url.pathname}` === this.graphqlURL,
      (route) => this.handleGraphQLRoute(route),
    );
    await context.route(STATUS_URL, (route) =>
      route.fulfill({ json: { result: { status_overall: { status_code: this.statusCode } } } }),
    );
  }

  /**
   * Answer a request to the REST API.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    // Keep the encoded slashes of a project or file path, so the path can be split into segments
    const path = url.pathname.slice(new URL(this.apiRoot).pathname.length);

    await this.answer(
      route,
      `${method} ${path}`,
      () => this.handleREST(method, path, request.postDataJSON(), url.searchParams),
      { status: 404, json: { message: '404 Not Found' } },
    );
  }

  /**
   * Answer a request to the GraphQL API.
   * @param {Route} route Route.
   */
  async handleGraphQLRoute(route) {
    const { query, variables } = route.request().postDataJSON();

    await this.answer(
      route,
      `GraphQL ${query.trim().slice(0, 120)}`,
      () => {
        const data = this.handleGraphQL(query, variables);

        return data ? { json: data } : undefined;
      },
      { json: { data: null, errors: [{ message: 'Not mocked' }] } },
    );
  }

  /**
   * Answer a request to the REST API.
   * @param {string} method HTTP method.
   * @param {string} pathname URL path after the API root, e.g. `/user`, still URL-encoded.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} searchParams URL query.
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleREST(method, pathname, body, searchParams) {
    if (pathname === '/user') {
      const { id, login, name, email } = this.user;

      return {
        json: {
          id,
          username: login,
          name,
          email,
          avatar_url: '',
          web_url: `https://gitlab.com/${login}`,
        },
      };
    }

    if (pathname === '/avatar') {
      return { json: { avatar_url: '' } };
    }

    // The deployments of the project, the latest first, as reported with `reportBuild()`
    if (method === 'GET' && pathname === `${this.projectPath}/deployments`) {
      return {
        json: [...this.builds]
          .flatMap(([sha, { deployments }]) =>
            deployments.map(({ environment, status, url }) => ({
              sha,
              status,
              environment: { name: environment, external_url: url },
            })),
          )
          .reverse(),
      };
    }

    if (pathname.startsWith(`${this.projectPath}/merge_requests`)) {
      return this.handleMergeRequestRequest(
        method,
        pathname
          .slice(`${this.projectPath}/merge_requests`.length)
          .split('/')
          .filter(Boolean)
          .map((segment) => decodeURIComponent(segment)),
        body,
        searchParams,
      );
    }

    if (!pathname.startsWith(`${this.projectPath}/repository/`)) {
      return undefined;
    }

    const [resource, ...rest] = pathname
      .slice(`${this.projectPath}/repository/`.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment));

    // A comparison of a branch with a commit, from where they parted
    if (method === 'GET' && resource === 'compare') {
      const from = searchParams.get('from') ?? '';
      const head = this.getCommit(searchParams.get('to') ?? '');

      return head && this.refs.has(from)
        ? { json: { diffs: this.diffCommit(head, from) } }
        : { status: 404, json: { message: '404 Not Found' } };
    }

    if (method === 'DELETE' && resource === 'branches') {
      return this.deleteBranch(rest.join('/'))
        ? { status: 204 }
        : { status: 404, json: { message: '404 Branch Not Found' } };
    }

    if (method === 'GET' && resource === 'branches') {
      const branch = rest.join('/');

      return this.refs.has(branch)
        ? {
            json: {
              name: branch,
              can_push: this.canPush,
              commit: { id: this.getHead(branch).oid },
            },
          }
        : { status: 404, json: { message: '404 Branch Not Found' } };
    }

    // A file’s path is a single, encoded segment, followed by `raw`
    if (method === 'GET' && resource === 'files' && rest[1] === 'raw') {
      const ref = searchParams.get('ref') ?? this.branch;
      const sha = this.refs.has(ref) ? this.getHead(ref).tree.get(rest[0]) : undefined;

      return sha
        ? { json: this.blobs.get(sha) }
        : { status: 404, json: { message: '404 File Not Found' } };
    }

    // The statuses an external CI service has posted on a commit
    if (method === 'GET' && resource === 'commits' && rest[1] === 'statuses') {
      return { json: this.builds.get(rest[0])?.statuses ?? [] };
    }

    if (method === 'GET' && resource === 'commits' && !rest.length) {
      const path = searchParams.get('path') ?? '';
      const branch = searchParams.get('ref_name') ?? this.branch;

      return {
        json: this.getFileCommits(path, branch)
          .slice(0, Number(searchParams.get('per_page') ?? 20))
          .map((commit) => this.toCommitItem(commit)),
      };
    }

    if (method === 'POST' && resource === 'commits' && !rest.length) {
      return this.handleCommit(/** @type {Record<string, any>} */ (body));
    }

    return undefined;
  }

  /**
   * Answer a GraphQL query.
   * @param {string} query Query.
   * @param {Record<string, any>} variables Variables.
   * @returns {Record<string, any> | undefined} Response body, or `undefined` if the query isn’t
   * mocked.
   */
  handleGraphQL(query, variables) {
    if (variables.fullPath !== `${this.owner}/${this.repo}`) {
      return { data: { project: null } };
    }

    if (query.includes('userPermissions')) {
      return { data: { project: { userPermissions: { pushCode: this.canWrite } } } };
    }

    if (query.includes('mergeRequests(iids:')) {
      return {
        data: {
          project: {
            mergeRequests: {
              nodes: /** @type {string[]} */ (variables.iids).map((iid) => ({
                iid,
                userPermissions: { canMerge: true },
              })),
            },
          },
        },
      };
    }

    if (query.includes('rootRef')) {
      return { data: { project: { repository: { rootRef: this.branch } } } };
    }

    // The variable holds a branch name or, for the contents of a merge request, its head commit
    const { branch } = variables;
    const head = this.refs.has(branch) ? this.getHead(branch) : this.getCommit(branch);

    if (query.includes('lastCommit')) {
      return {
        data: {
          project: {
            repository: {
              tree: head ? { lastCommit: { sha: head.oid, message: head.message } } : null,
            },
          },
        },
      };
    }

    // The file list, a page at a time, with the index of the next file as the cursor
    if (query.includes('blobs(after:')) {
      const entries = [...(head?.tree ?? [])].sort(([a], [b]) => a.localeCompare(b));
      const start = Number(variables.cursor || 0);
      const end = start + this.treePageSize;

      return {
        data: {
          project: {
            repository: {
              tree: {
                blobs: {
                  nodes: entries
                    .slice(start, end)
                    .map(([path, sha]) => ({ type: 'blob', path, sha })),
                  pageInfo: { endCursor: String(end), hasNextPage: end < entries.length },
                },
              },
            },
          },
        },
      };
    }

    // The blob IDs of files, which GitLab leaves out for a path that isn’t on the branch
    if (query.includes('blobs(ref:') && !query.includes('rawTextBlob')) {
      return {
        data: {
          project: {
            repository: {
              blobs: {
                nodes: /** @type {string[]} */ (variables.paths).flatMap((path) => {
                  const sha = head?.tree.get(path);

                  return sha ? [{ path, oid: sha }] : [];
                }),
              },
            },
          },
        },
      };
    }

    // The contents of text files, which GitLab leaves out for a path that isn’t on the branch
    if (query.includes('rawTextBlob')) {
      return {
        data: {
          project: {
            repository: {
              blobs: {
                nodes: /** @type {string[]} */ (variables.paths).flatMap((path) => {
                  const sha = head?.tree.get(path);
                  const blob = sha ? this.blobs.get(sha) : undefined;

                  return blob
                    ? [{ path, oid: sha, size: String(blob.length), rawTextBlob: blob.toString() }]
                    : [];
                }),
              },
            },
          },
        },
      };
    }

    return undefined;
  }

  /**
   * Make an item of a commit listing.
   * @param {MockCommit} commit Commit.
   * @returns {Record<string, any>} Item.
   */
  toCommitItem({ oid, message, date, author }) {
    return {
      id: oid,
      short_id: oid.slice(0, 8),
      title: message.split('\n')[0],
      message,
      author_name: author.name,
      author_email: author.email,
      committed_date: date.toISOString(),
    };
  }

  /**
   * Get the last commit that changed a file, as of a commit.
   * @param {string} path File path.
   * @param {string} oid Commit SHA.
   * @returns {MockCommit | undefined} Commit.
   */
  getLastCommitOf(path, oid) {
    return this.getAncestors(oid).find(({ paths }) => paths.has(path));
  }

  /**
   * Handle a request to commit several file actions at once, to a branch, or to a new one created
   * from a `start_branch`. Like GitLab, refuse to create a branch or a file that already exists, or
   * to change a file that doesn’t, and refuse an action carrying a `last_commit_id` when the file
   * has changed since that commit, all with 400 Bad Request.
   * @param {Record<string, any>} body Request body.
   * @returns {MockResponse} Response.
   */
  handleCommit(body) {
    this.received.push(body);

    const { beforeCommit } = this;

    this.beforeCommit = undefined;
    beforeCommit?.();

    const { branch, commit_message: message, actions, start_branch: startBranch } = body;

    if (!this.canPush) {
      return { status: 403, json: { message: '403 Forbidden' } };
    }

    // A commit with a start branch creates the branch, which GitLab refuses if it exists already
    if (startBranch && this.refs.has(branch)) {
      return { status: 400, json: { message: `A branch called '${branch}' already exists.` } };
    }

    const head = this.getHead(startBranch ?? branch);
    const tree = new Map(head.tree);
    /** @type {string[]} */
    const paths = [];

    /** @type {MockResponse | undefined} */
    const refusal = /** @type {Record<string, any>[]} */ (actions)
      .map(
        ({
          action,
          file_path: path,
          previous_path: previousPath,
          content,
          encoding,
          last_commit_id: lastCommitId,
        }) => {
          const knownPath = previousPath ?? path;

          if (action === 'create') {
            if (tree.has(path)) {
              return { status: 400, json: { message: 'A file with this name already exists' } };
            }
          } else if (!tree.has(knownPath)) {
            return { status: 400, json: { message: 'A file with this name doesn’t exist' } };
          } else if (
            lastCommitId &&
            this.getLastCommitOf(knownPath, head.oid)?.oid !==
              this.getLastCommitOf(knownPath, lastCommitId)?.oid
          ) {
            return {
              status: 400,
              json: {
                message:
                  'You are attempting to update a file that has changed since you started editing it.',
              },
            };
          }

          if (action === 'delete') {
            tree.delete(path);
            paths.push(path);

            return undefined;
          }

          if (action === 'move') {
            tree.delete(previousPath);
            paths.push(previousPath);
          }

          const buffer = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8');
          const sha = getBlobSHA(buffer);

          this.blobs.set(sha, buffer);
          tree.set(path, sha);
          paths.push(path);

          return undefined;
        },
      )
      .find((response) => !!response);

    if (refusal) {
      return refusal;
    }

    const commit = this.addCommit({
      tree,
      paths,
      message,
      author: /** @type {MockUser} */ (this.user),
      parents: [head.oid],
    });

    this.refs.set(branch, commit.oid);

    return { status: 201, json: this.toCommitItem(commit) };
  }
}
