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
 * @property {string} sourceBranch Branch the changes come from, as {@link MockGitLab.refs} keys it,
 * so a branch in a fork reads `owner:branch`.
 * @property {number} sourceProjectId ID of the project the source branch lives in, which is the
 * fork’s for a merge request an Open Authoring contributor opened.
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
   * Numeric ID of the configured project, which the API reports where an encoded path won’t do:
   * the source and target of a merge request, and the project a comparison runs against.
   */
  projectId = 1;

  /**
   * Numeric ID of the fork.
   */
  forkProjectId = 2;

  /**
   * Whether the project allows forks. GitLab turns forking off by default on a private project.
   */
  allowForking = true;

  /**
   * The signed-in user’s fork of the project, once {@link createFork} has made it.
   * @type {{ owner: string, repo: string } | undefined}
   */
  fork = undefined;

  /**
   * How many times a newly requested fork reports an unfinished import before it’s ready, as GitLab
   * copies the repository in the background.
   */
  forkImportDelay = 0;

  /**
   * How many more requests for the fork report an unfinished import; see {@link forkImportDelay}.
   */
  forkPendingRequests = 0;

  /**
   * Maximum number of files in a page of the file list, which GitLab limits to 100.
   */
  treePageSize = 100;

  /**
   * Maximum number of merge requests in a page of the merge request list. A test lowers it to stand
   * in for a contributor with more merge requests in the project than the CMS reads in one page,
   * rather than opening a hundred of them.
   */
  mergeRequestPageSize = Infinity;

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
   * Path of the fork in the REST API. It’s the path the CMS asks for even before the fork exists,
   * which is how it finds out it has to make one.
   * @type {string}
   */
  get forkPath() {
    return `/projects/${encodeURIComponent(`${this.user.login}/${this.fork?.repo ?? this.repo}`)}`;
  }

  /**
   * Path the CMS looks for a fork at first: the signed-in user’s namespace and the project’s own
   * name. It’s where a fork is unless the contributor renamed it.
   * @type {string}
   */
  get defaultForkPath() {
    return `/projects/${encodeURIComponent(`${this.user.login}/${this.repo}`)}`;
  }

  /**
   * Fork the project onto the signed-in user’s namespace, with a copy of the default branch. Like a
   * fork on GitLab, it shares the commits and blobs of the project, and only its branches are its
   * own.
   * @param {object} [options] Options.
   * @param {string} [options.repo] Name of the fork, the project’s own by default. A fork has
   * another name when the contributor renamed it.
   * @returns {{ owner: string, repo: string }} Fork.
   */
  createFork({ repo = this.repo } = {}) {
    this.fork = { owner: this.user.login, repo };
    this.refs.set(this.forkBranch(this.branch), this.head.oid);

    return this.fork;
  }

  /**
   * Find a project the way GitLab does for a project parameter in a request body, such as a
   * commit’s `start_project`: by its numeric ID, or by its full path as is. A path URL-encoded the
   * way it is in a request path names no project.
   * @param {number | string} idOrPath Project ID or full path.
   * @returns {number | undefined} Project ID, or `undefined` if there’s no such project.
   */
  findProject(idOrPath) {
    /** @type {[number, string][]} */
    const projects = [[this.projectId, `${this.owner}/${this.repo}`]];

    if (this.fork) {
      projects.push([this.forkProjectId, `${this.fork.owner}/${this.fork.repo}`]);
    }

    return projects.find(([id, path]) => String(idOrPath) === String(id) || idOrPath === path)?.[0];
  }

  /**
   * Get the key of a branch in the fork, for {@link refs}, {@link commit} and {@link readFile}.
   * @param {string} branch Branch name.
   * @returns {string} Key, e.g. `mona:main`.
   */
  forkBranch(branch) {
    return `${this.user.login}:${branch}`;
  }

  /**
   * Describe a project the way the REST API does.
   * @param {object} args Arguments.
   * @param {boolean} args.isFork Whether it’s the signed-in user’s fork.
   * @returns {Record<string, any>} Project.
   */
  toProjectItem({ isFork }) {
    const owner = isFork ? this.user.login : this.owner;
    const repo = isFork ? /** @type {{ repo: string }} */ (this.fork).repo : this.repo;

    return {
      id: isFork ? this.forkProjectId : this.projectId,
      path_with_namespace: `${owner}/${repo}`,
      namespace: { kind: isFork ? 'user' : 'group', full_path: owner },
      forking_access_level: this.allowForking ? 'enabled' : 'disabled',
      ...(isFork
        ? {
            import_status: 'finished',
            forked_from_project: { path_with_namespace: `${this.owner}/${this.repo}` },
          }
        : {}),
    };
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
   * @param {number} [args.sourceProjectId] ID of the project the source branch lives in, the
   * configured project’s by default.
   * @returns {MockMergeRequest} Merge request.
   */
  openMergeRequest({
    title,
    sourceBranch,
    targetBranch = this.branch,
    labels = [],
    author = this.colleague,
    sourceProjectId = this.projectId,
  }) {
    const now = new Date();

    /** @type {MockMergeRequest} */
    const mergeRequest = {
      iid: this.mergeRequests.length + 1,
      id: 1000 + this.mergeRequests.length + 1,
      title,
      sourceBranch,
      sourceProjectId,
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
    const { iid, id, title, sourceBranch, sourceProjectId, targetBranch, labels, state, author } =
      mergeRequest;

    const open = state === 'opened' && this.refs.has(sourceBranch);
    // A merge request from a fork names its source branch without the owner prefix the mock keys it
    // with, the way GitLab reports a branch in the source project
    const [, plainSourceBranch = sourceBranch] = sourceBranch.match(/^[^:]+:(.+)$/) ?? [];

    return {
      id,
      iid,
      title,
      state,
      // GitLab has no draft field to set: the read-only one is derived from the title
      // @see https://docs.gitlab.com/user/project/merge_requests/drafts/
      draft: /^\s*(?:\[draft\]|\(draft\)|draft:|draft\s|\[wip\]|\(wip\)|wip:|wip\s)/i.test(title),
      labels,
      source_branch: plainSourceBranch,
      target_branch: targetBranch,
      source_project_id: sourceProjectId,
      target_project_id: this.projectId,
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
   * @param {boolean} [fromFork] Whether the request was made on the fork, which only happens when
   * an Open Authoring contributor opens a merge request from a branch there.
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleMergeRequestRequest(method, segments, body, searchParams, fromFork = false) {
    if (!segments.length) {
      if (method === 'GET') {
        const state = searchParams.get('state');
        const labels = searchParams.get('labels')?.split(',') ?? [];
        const sourceBranch = searchParams.get('source_branch');
        const authorId = searchParams.get('author_id');
        // The Open Authoring flow asks for the newest first by creation; everything else by update
        const byCreation = searchParams.get('order_by') === 'created_at';

        return {
          json: this.mergeRequests
            .filter(
              (mr) =>
                (!state || state === 'all' || mr.state === state) &&
                labels.every((label) => mr.labels.includes(label)) &&
                // A fork’s branch is keyed with its owner, which the filter is given without
                (!sourceBranch ||
                  mr.sourceBranch === sourceBranch ||
                  mr.sourceBranch.endsWith(`:${sourceBranch}`)) &&
                (!authorId || mr.author.id === Number(authorId)),
            )
            .sort((a, b) =>
              byCreation
                ? b.createdAt.getTime() - a.createdAt.getTime()
                : b.updatedAt.getTime() - a.updatedAt.getTime(),
            )
            .slice(0, this.mergeRequestPageSize)
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

        // A merge request opened on the fork targets the configured project by ID, and its source
        // branch lives in the fork
        const branchKey = fromFork ? this.forkBranch(sourceBranch) : sourceBranch;

        // Like GitLab, refuse a second open merge request from the same branch to the same target
        if (this.getOpenMergeRequest(branchKey, targetBranch)) {
          return {
            status: 409,
            json: { message: ['Another open merge request already exists for this source branch'] },
          };
        }

        const mergeRequest = this.openMergeRequest({
          title,
          sourceBranch: branchKey,
          sourceProjectId: fromFork ? this.forkProjectId : this.projectId,
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

      // A closed merge request can be reopened, which is how an Open Authoring contributor sends an
      // entry for review again after taking it back to the drafting stage
      if (body?.state_event === 'reopen') {
        Object.assign(mergeRequest, { state: 'opened', lastHead: undefined });
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

    // What the sign-in reads to find out whether the project can be forked, and its numeric ID
    if (method === 'GET' && pathname === this.projectPath) {
      return { json: this.toProjectItem({ isFork: false }) };
    }

    // The forks of the project the signed-in user owns, which is theirs or none
    if (method === 'GET' && pathname === `${this.projectPath}/forks`) {
      return { json: this.fork ? [this.toProjectItem({ isFork: true })] : [] };
    }

    if (method === 'POST' && pathname === `${this.projectPath}/fork`) {
      if (!this.allowForking) {
        return { status: 409, json: { message: 'Forking is not allowed' } };
      }

      if (this.fork) {
        return { status: 409, json: { message: 'Project namespace name has already been taken' } };
      }

      this.createFork();
      this.forkPendingRequests = this.forkImportDelay;

      return { status: 201, json: this.toProjectItem({ isFork: true }) };
    }

    // Everything below is addressed to the configured project or to the signed-in user’s fork. The
    // fork’s path is answered even before it exists, which is how the CMS finds out it has to make
    // one
    const onFork = pathname === this.forkPath || pathname.startsWith(`${this.forkPath}/`);
    const projectPath = onFork ? this.forkPath : this.projectPath;

    // The CMS looks for the fork at the project’s own name first, which isn’t where a renamed fork
    // is. GitLab answers 404, which is how the CMS knows to look it up in the fork list instead
    if (!onFork && pathname === this.defaultForkPath) {
      return { status: 404, json: { message: '404 Project Not Found' } };
    }

    if (onFork) {
      if (!this.fork) {
        return { status: 404, json: { message: '404 Project Not Found' } };
      }

      if (pathname === this.forkPath) {
        if (this.forkPendingRequests > 0) {
          this.forkPendingRequests -= 1;

          return { json: { ...this.toProjectItem({ isFork: true }), import_status: 'started' } };
        }

        return { json: this.toProjectItem({ isFork: true }) };
      }
    }

    if (pathname.startsWith(`${projectPath}/merge_requests`)) {
      return this.handleMergeRequestRequest(
        method,
        pathname
          .slice(`${projectPath}/merge_requests`.length)
          .split('/')
          .filter(Boolean)
          .map((segment) => decodeURIComponent(segment)),
        body,
        searchParams,
        onFork,
      );
    }

    if (!pathname.startsWith(`${projectPath}/repository/`)) {
      return undefined;
    }

    const [resource, ...rest] = pathname
      .slice(`${projectPath}/repository/`.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment));

    // A comparison of a branch with a commit, from where they parted. One across projects is an
    // Open Authoring draft’s, answered further down
    if (method === 'GET' && resource === 'compare' && !searchParams.has('from_project_id')) {
      const from = searchParams.get('from') ?? '';
      const head = this.getCommit(searchParams.get('to') ?? '');

      return head && this.refs.has(from)
        ? { json: { diffs: this.diffCommit(head, from) } }
        : { status: 404, json: { message: '404 Not Found' } };
    }

    /**
     * Get the key a branch of the project being addressed has in {@link refs}.
     * @param {string} branch Branch name.
     * @returns {string} Key.
     */
    const toRef = (branch) => (onFork ? this.forkBranch(branch) : branch);

    if (method === 'DELETE' && resource === 'branches') {
      return this.deleteBranch(toRef(rest.join('/')))
        ? { status: 204 }
        : { status: 404, json: { message: '404 Branch Not Found' } };
    }

    // The branches of the project whose name begins with the `^prefix` search term, which is how
    // the CMS lists an Open Authoring contributor’s Editorial Workflow branches in their fork
    if (method === 'GET' && resource === 'branches' && !rest.length) {
      const search = searchParams.get('search') ?? '';
      const prefix = search.startsWith('^') ? search.slice(1) : undefined;
      const keyPrefix = toRef('');

      return {
        json: [...this.refs.keys()]
          .filter((key) => key.startsWith(keyPrefix) || (!onFork && !key.includes(':')))
          .map((key) => (onFork ? key.slice(keyPrefix.length) : key))
          .filter((branch) => (prefix ? branch.startsWith(prefix) : branch.includes(search)))
          .sort()
          .map((branch) => {
            const { oid, message, date, author } = this.getHead(toRef(branch));

            return {
              name: branch,
              can_push: this.canPush,
              commit: {
                id: oid,
                message,
                author_name: author.name,
                author_email: author.email,
                committed_date: date.toISOString(),
              },
            };
          }),
      };
    }

    if (method === 'GET' && resource === 'branches') {
      const branch = toRef(rest.join('/'));

      return this.refs.has(branch)
        ? {
            json: {
              name: rest.join('/'),
              can_push: this.canPush,
              commit: { id: this.getHead(branch).oid },
            },
          }
        : { status: 404, json: { message: '404 Branch Not Found' } };
    }

    // The files a branch changes against a branch of another project, which is how the CMS works
    // out what an Open Authoring draft holds: it has no merge request to list the files from
    // @see https://docs.gitlab.com/api/repositories/#compare-branches-tags-or-commits
    if (method === 'GET' && resource === 'compare') {
      const from = searchParams.get('from') ?? '';
      const to = searchParams.get('to') ?? '';
      const fromProjectId = Number(searchParams.get('from_project_id'));
      // `from` lives in `from_project_id`, `to` in the project the request was made on
      const fromRef = fromProjectId === this.forkProjectId ? this.forkBranch(from) : from;

      if (!this.refs.has(fromRef) || !this.refs.has(toRef(to))) {
        return { status: 404, json: { message: '404 Ref Not Found' } };
      }

      const head = this.getHead(toRef(to));
      const mergeBase = this.getMergeBase(head.oid, this.getHead(fromRef).oid);

      return {
        json: {
          diffs: MockGitLab.diffTrees(mergeBase.tree, head.tree).map(({ path, changeType }) => ({
            old_path: path,
            new_path: path,
            new_file: changeType === 'ADDED',
            deleted_file: changeType === 'DELETED',
            renamed_file: false,
          })),
        },
      };
    }

    // A file’s path is a single, encoded segment, followed by `raw`
    if (method === 'GET' && resource === 'files' && rest[1] === 'raw') {
      const ref = toRef(searchParams.get('ref') ?? this.branch);
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
      const branch = toRef(searchParams.get('ref_name') ?? this.branch);

      return {
        json: this.getFileCommits(path, branch)
          .slice(0, Number(searchParams.get('per_page') ?? 20))
          .map((commit) => this.toCommitItem(commit)),
      };
    }

    if (method === 'POST' && resource === 'commits' && !rest.length) {
      return this.handleCommit(/** @type {Record<string, any>} */ (body), onFork);
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
    // The blobs of a workflow branch are read from the fork with Open Authoring, so the query names
    // the fork’s path and its branches have to be resolved there
    const onFork = !!this.fork && variables.fullPath === `${this.user.login}/${this.fork.repo}`;

    if (!onFork && variables.fullPath !== `${this.owner}/${this.repo}`) {
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
    const branch = onFork ? this.forkBranch(variables.branch) : variables.branch;
    const head = this.refs.has(branch) ? this.getHead(branch) : this.getCommit(variables.branch);

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
   * @param {boolean} [onFork] Whether the commit goes to the signed-in user’s fork, which is where
   * an Open Authoring contributor’s workflow branches live.
   * @returns {MockResponse} Response.
   */
  handleCommit(body, onFork = false) {
    this.received.push(body);

    const { beforeCommit } = this;

    this.beforeCommit = undefined;
    beforeCommit?.();

    const {
      commit_message: message,
      actions,
      start_branch: startBranch,
      start_project: startProject,
    } = body;

    const branch = onFork ? this.forkBranch(body.branch) : body.branch;

    // A contributor has no write access to the configured project, and the branch protection the
    // flag stands for doesn’t apply to their own fork
    if (!this.canPush && !onFork) {
      return { status: 403, json: { message: '403 Forbidden' } };
    }

    // A commit with a start branch creates the branch, which GitLab refuses if it exists already
    if (startBranch && this.refs.has(branch)) {
      return {
        status: 400,
        json: { message: `A branch called '${body.branch}' already exists.` },
      };
    }

    // The branch can start from a branch of another project, which is how a contributor’s workflow
    // branch starts from the configured project’s head rather than their fork’s copy of it
    const startProjectId = startProject === undefined ? undefined : this.findProject(startProject);

    if (startProject !== undefined && startProjectId === undefined) {
      return { status: 404, json: { message: '404 Project Not Found' } };
    }

    const startsOnFork =
      startProject === undefined ? onFork : startProjectId === this.forkProjectId;

    const startRef = startBranch
      ? startsOnFork
        ? this.forkBranch(startBranch)
        : startBranch
      : branch;

    const head = this.getHead(startRef);
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
