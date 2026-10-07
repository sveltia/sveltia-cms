import { createHash } from 'crypto';

import { MockGitRepository } from './git.js';

/**
 * @import { Page, Route } from '@playwright/test';
 * @import { MockCommit, MockResponse, MockUser } from './git.js';
 */

/**
 * @typedef {object} MockPullRequest
 * @property {number} number Pull request number, shared with the issues like on GitHub.
 * @property {string} nodeId GraphQL node ID.
 * @property {string} title Title.
 * @property {string} body Description.
 * @property {string} head Name of the branch the changes come from.
 * @property {string} base Name of the branch the changes go to.
 * @property {'open' | 'closed' | 'merged'} state State.
 * @property {boolean} draft Whether the pull request is a draft.
 * @property {string[]} labels Label names.
 * @property {MockUser} author Author.
 * @property {Date} createdAt Creation date.
 * @property {Date} updatedAt Last update date.
 * @property {string} [mergeCommit] SHA of the commit that merged the pull request.
 * @property {string} [lastHead] SHA of the head commit when the pull request was closed or merged,
 * which stays known after its branch is deleted.
 */

/**
 * Pattern of a string literal in a GraphQL query, as the CMS writes one with `JSON.stringify()`.
 * The patterns below allow for any whitespace, as the CMS collapses it before sending a query.
 */
const STRING = '("(?:[^"\\\\]|\\\\.)*")';
/**
 * Strip the `refs/heads/` prefix from a qualified ref name, which the GraphQL API accepts along
 * with a bare branch name.
 * @param {string} ref Ref name, e.g. `refs/heads/main` or `main`.
 * @returns {string} Branch name.
 */
const toBranchName = (ref) => ref.replace(/^refs\/heads\//, '');

/**
 * Split a key of {@link MockGitHub.refs} into the owner of the repository the branch is in and the
 * branch name. A branch in the fork is keyed as `owner:branch`, which is also how a pull request
 * from the fork names its head.
 * @param {string} key Branch key, e.g. `main` or `mona:cms/mona/e2e-site/posts/hello`.
 * @returns {{ owner: string | undefined, name: string }} Owner of the fork, if the branch is in
 * one, and the branch name.
 */
const splitBranchKey = (key) => {
  const index = key.indexOf(':');

  return index === -1
    ? { owner: undefined, name: key }
    : { owner: key.slice(0, index), name: key.slice(index + 1) };
};

/**
 * A GitHub repository behind a mocked REST and GraphQL API, for the CMS to sign in to, load files
 * from and commit to. A test can commit to it as someone else with {@link MockGitHub.commit} to
 * simulate a colleague’s change, and check what the CMS committed in {@link MockGitHub.received}:
 * the `createCommitOnBranch` inputs it has sent.
 * Branches and pull requests work as well, with labels and the draft state, for Editorial Workflow.
 * For Open Authoring, the signed-in user can be denied write access with
 * {@link MockGitHub.canWrite}, and given a fork with {@link MockGitHub.createFork}.
 */
export class MockGitHub extends MockGitRepository {
  /**
   * Root of the REST API: GitHub’s, or a GitHub Enterprise Server’s like
   * `https://github.example.com/api/v3`. Set it before the page is opened.
   */
  apiRoot = 'https://api.github.com';

  /**
   * URL of the GraphQL API, e.g. `https://github.example.com/api/graphql` for GitHub Enterprise.
   */
  graphqlURL = 'https://api.github.com/graphql';

  /**
   * GraphQL node ID of the repository.
   */
  repositoryId = 'R_e2e';

  /**
   * Whether the signed-in user can write to the repository. A user who can’t is refused, unless
   * Open Authoring is on, which makes them a contributor who works on a fork.
   */
  canWrite = true;

  /**
   * Whether the signed-in user can read the repository. The repository is private, then, for
   * someone who can’t.
   */
  canRead = true;

  /**
   * The protection rule on the configured branch as it applies to the signed-in user, e.g.
   * `{ viewerCanPush: false }` for a branch that requires a pull request. `null` for a branch that
   * isn’t protected.
   * @type {{ viewerCanPush: boolean } | null}
   */
  branchRule = null;

  /**
   * Whether the API rate limit is exhausted, so the repository can’t be read for now.
   */
  rateLimited = false;

  /**
   * Paths of the files whose commit history comes back empty, as for a file deleted since the CMS
   * fetched the file tree.
   * @type {Set<string>}
   */
  pathsWithoutHistory = new Set();

  /**
   * Whether the recursive listing of a commit’s file tree is truncated, as GitHub does for a tree
   * with too many entries, so the CMS has to list the directories one by one. The listing then only
   * has the files and directories at the top level.
   */
  truncateTree = false;

  /**
   * The directories handed out as `tree` entries in a file tree that isn’t listed recursively,
   * keyed by their made-up tree SHA, so they can be listed in turn.
   * @type {Map<string, { tree: Map<string, string>, prefix: string }>}
   */
  subtrees = new Map();

  /**
   * The OAuth scopes of the sign-in, as GitHub reports them in the `X-OAuth-Scopes` header, e.g.
   * `public_repo`. The header is left out when it’s `undefined`, like for a fine-grained token.
   * @type {string | undefined}
   */
  scopes = undefined;

  /**
   * Repositories the signed-in user has been invited to and hasn’t accepted yet, as `owner/repo`.
   * @type {string[]}
   */
  invitations = [];

  /**
   * Whether the repository allows forking.
   */
  allowForking = true;

  /**
   * The signed-in user’s fork of the repository, once {@link createFork} has made it.
   * @type {{ owner: string, repo: string } | undefined}
   */
  fork = undefined;

  /**
   * GraphQL node ID of the fork.
   */
  forkId = 'R_e2e_fork';

  /**
   * How many times a newly requested fork answers 404 before it’s ready, as GitHub copies the
   * repository in the background.
   */
  forkDelay = 0;

  /**
   * How many more requests for the fork answer 404 before it’s ready; see {@link forkDelay}.
   */
  forkPendingRequests = 0;

  /**
   * Pull requests, open or not, the oldest first.
   * @type {MockPullRequest[]}
   */
  pullRequests = [];

  /**
   * Builds reported for each commit with {@link reportBuild}, keyed by commit SHA.
   * @type {Map<string, Record<string, any[]>>}
   */
  builds = new Map();

  /**
   * Overall status of GitHub as its status page reports it: `none`, `minor`, `major` or
   * `critical`. The CMS shows an incident above the app.
   */
  statusIndicator = 'none';

  /**
   * The `repository_dispatch` events the CMS has sent to trigger a deployment, by their type.
   * @type {string[]}
   */
  dispatches = [];

  /**
   * Fork the repository onto the signed-in user’s account, with a copy of the default branch. Like
   * a fork on GitHub, it shares the commits and blobs of the repository, and only its branches are
   * its own.
   * @param {object} [options] Options.
   * @param {string} [options.repo] Name of the fork, the repository’s own by default. A fork has
   * another name when it was renamed, or when the user already had a repository of that name.
   * @returns {{ owner: string, repo: string }} Fork.
   */
  createFork({ repo = this.repo } = {}) {
    this.fork = { owner: this.user.login, repo };
    this.refs.set(this.forkBranch(this.branch), this.head.oid);

    return this.fork;
  }

  /**
   * Get the key of a branch in the fork, for {@link refs}, {@link commit}, {@link readFile} and
   * the `head` of a pull request.
   * @param {string} branch Branch name.
   * @returns {string} Key, e.g. `mona:main`.
   */
  forkBranch(branch) {
    return `${this.user.login}:${branch}`;
  }

  /**
   * Get the key of a branch in the repository of the given owner: the fork if it’s the signed-in
   * user, the repository itself otherwise.
   * @param {string | undefined} owner Repository owner.
   * @param {string} branch Branch name.
   * @returns {string} Key.
   */
  toBranchKey(owner, branch) {
    return owner && owner !== this.owner ? `${owner}:${branch}` : branch;
  }

  /**
   * Get the files a pull request changes: the difference between its merge base and its head, the
   * same as GitHub’s “Files changed”.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {{ path: string, changeType: string }[]} Changed files.
   */
  getPullRequestFiles(pullRequest) {
    const head = this.getPullRequestHead(pullRequest);
    const base = this.getMergeBase(head.oid, this.getHead(pullRequest.base).oid);

    return MockGitHub.diffTrees(base.tree, head.tree);
  }

  /**
   * Get the head commit of a pull request. Like on GitHub, a pull request that has been closed or
   * merged stays at the head it had then, even if its branch has moved on or is gone since.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {MockCommit} Commit.
   */
  getPullRequestHead(pullRequest) {
    return this.refs.has(pullRequest.head) &&
      (pullRequest.state === 'open' || !pullRequest.lastHead)
      ? this.getHead(pullRequest.head)
      : /** @type {MockCommit} */ (this.getCommit(/** @type {string} */ (pullRequest.lastHead)));
  }

  /**
   * Find a pull request by its number.
   * @param {number} number Pull request number.
   * @returns {MockPullRequest | undefined} Pull request.
   */
  getPullRequest(number) {
    return this.pullRequests.find((pr) => pr.number === number);
  }

  /**
   * Find every open pull request from a branch, whichever branch each one goes to.
   * @param {string} branch Head branch name.
   * @returns {MockPullRequest[]} Pull requests.
   */
  getOpenPullRequests(branch) {
    return this.pullRequests.filter(({ head, state }) => head === branch && state === 'open');
  }

  /**
   * Find the open pull request from a branch to the given base branch. Like GitHub, a pull request
   * to another branch doesn’t count: a head branch can have one open pull request per base branch.
   * @param {string} branch Head branch name.
   * @param {string} [base] Base branch name, the default branch by default.
   * @returns {MockPullRequest | undefined} Pull request.
   */
  getOpenPullRequest(branch, base = this.branch) {
    return this.getOpenPullRequests(branch).find((pr) => pr.base === base);
  }

  /**
   * Delete a branch. Like GitHub’s automatic head branch deletion, this also happens to the branch
   * of a merged pull request when the test says so.
   * @param {string} branch Branch name.
   * @returns {boolean} Whether the branch existed.
   */
  deleteBranch(branch) {
    // GitHub closes every open pull request whose head branch is deleted
    this.getOpenPullRequests(branch).forEach((pullRequest) => {
      Object.assign(pullRequest, {
        state: 'closed',
        lastHead: this.refs.get(branch),
        updatedAt: new Date(),
      });
    });

    return this.refs.delete(branch);
  }

  /**
   * Open a pull request.
   * @param {object} args Arguments.
   * @param {string} args.title Title.
   * @param {string} args.head Head branch.
   * @param {string} [args.base] Base branch, the default branch by default.
   * @param {boolean} [args.draft] Whether to open a draft pull request.
   * @param {string} [args.body] Description.
   * @param {string[]} [args.labels] Labels.
   * @param {MockUser} [args.author] Author, the colleague by default.
   * @returns {MockPullRequest} Pull request.
   */
  openPullRequest({
    title,
    head,
    base = this.branch,
    draft = false,
    body = '',
    labels = [],
    author = this.colleague,
  }) {
    const now = new Date();

    /** @type {MockPullRequest} */
    const pullRequest = {
      number: this.pullRequests.length + 1,
      nodeId: `PR_${this.pullRequests.length + 1}`,
      title,
      body,
      head,
      base,
      state: 'open',
      draft,
      labels,
      author,
      createdAt: now,
      updatedAt: now,
    };

    this.pullRequests.push(pullRequest);

    return pullRequest;
  }

  /**
   * Merge a pull request into its base branch, like the Merge button on GitHub does. The changes
   * are merged file by file; a file both branches have changed differently since they parted is a
   * conflict, which GitHub refuses to merge.
   * @param {MockPullRequest} pullRequest Pull request.
   * @param {object} [options] Options.
   * @param {'merge' | 'squash'} [options.method] Merge method.
   * @param {string} [options.title] Commit title, the pull request title by default.
   * @param {MockUser} [options.author] Who merges it, the colleague by default.
   * @returns {MockCommit | undefined} Merge commit, or `undefined` if the pull request can’t be
   * merged.
   */
  mergePullRequest(pullRequest, { method = 'merge', title, author = this.colleague } = {}) {
    if (pullRequest.state !== 'open' || !this.refs.has(pullRequest.head)) {
      return undefined;
    }

    const { oid: headOid } = this.getHead(pullRequest.head);

    const commit = this.mergeBranch({
      head: pullRequest.head,
      base: pullRequest.base,
      method,
      message: title ?? pullRequest.title,
      author,
    });

    if (commit) {
      Object.assign(pullRequest, {
        state: 'merged',
        mergeCommit: commit.oid,
        lastHead: headOid,
        updatedAt: new Date(),
      });
    }

    return commit;
  }

  /**
   * Report the builds of a commit, as a CI/CD provider connected to the repository does: a
   * deployment with its environment, a check run, or a commit status. A later report replaces the
   * earlier ones, like a build moving on from pending.
   * @param {string} sha Commit SHA.
   * @param {object} builds Builds.
   * @param {{ environment: string, state: string, environmentUrl?: string, description?: string
   * }[]} [builds.deployments] Deployments, with a state like `PENDING`, `SUCCESS` or `FAILURE`.
   * @param {{ name: string, status: string, conclusion?: string, detailsUrl?: string, summary?:
   * string }[]} [builds.checkRuns] Check runs, with a status like `IN_PROGRESS` or `COMPLETED`.
   * @param {{ context: string, state: string, targetUrl?: string, description?: string }[]}
   * [builds.statuses] Commit statuses, with a state like `PENDING` or `SUCCESS`.
   */
  reportBuild(sha, { deployments = [], checkRuns = [], statuses = [] }) {
    this.builds.set(sha, { deployments, checkRuns, statuses });
  }

  /**
   * Get the builds of a commit in the shape of the GraphQL `Commit` fields the CMS asks for.
   * @param {string} sha Commit SHA.
   * @returns {Record<string, any>} Fields.
   */
  toBuildNodes(sha) {
    const { deployments = [], checkRuns = [], statuses = [] } = this.builds.get(sha) ?? {};

    return {
      status: statuses.length ? { contexts: statuses } : null,
      deployments: {
        nodes: deployments.map(({ environment, state, environmentUrl, description }) => ({
          environment,
          latestStatus: { state, environmentUrl, description },
        })),
      },
      checkSuites: { nodes: checkRuns.length ? [{ checkRuns: { nodes: checkRuns } }] : [] },
    };
  }

  /**
   * Route the GitHub requests of the pages in a browser context to the mock, including a sign-in
   * popup, and store a session for the user, so the CMS signs in on its own when the page is
   * opened.
   * @param {Page} page Page.
   * @param {object} [options] Options.
   * @param {boolean} [options.signedIn] Whether to store the session.
   */
  async install(page, { signedIn = true } = {}) {
    const context = page.context();

    if (signedIn) {
      await this.storeSession(page, 'github');
    }

    await context.route(
      (url) =>
        url.href.startsWith(`${this.apiRoot}/`) ||
        `${url.origin}${url.pathname}` === this.graphqlURL,
      (route) => this.handleRoute(route),
    );
    await context.route('https://www.githubstatus.com/**', (route) =>
      route.fulfill({ json: { status: { indicator: this.statusIndicator } } }),
    );
    await context.route('https://avatars.githubusercontent.com/**', (route) =>
      route.fulfill({ status: 404 }),
    );
  }

  /**
   * Answer a request to the GitHub API.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const url = new URL(request.url());
    // The path after the API root, e.g. `/user`
    const pathname = url.pathname.slice(new URL(this.apiRoot).pathname.replace(/\/$/, '').length);
    const method = request.method();

    if (!this.isAuthorized(request)) {
      await MockGitHub.respond(route, { status: 401, json: { message: 'Bad credentials' } });

      return;
    }

    if (`${url.origin}${url.pathname}` === this.graphqlURL) {
      const { query, variables } = request.postDataJSON();
      const data = this.handleGraphQL(query, variables);

      await route.fulfill({ json: data ?? { data: null, errors: [{ message: 'Not mocked' }] } });

      if (!data) {
        this.unhandled.push(`GraphQL ${query.trim().split('\n')[0]}`);
      }

      return;
    }

    const response = this.handleREST(method, pathname, request.postDataJSON(), url.searchParams);

    if (response) {
      await MockGitHub.respond(route, response);

      return;
    }

    this.unhandled.push(`${method} ${pathname}`);
    await route.fulfill({ status: 404, json: { message: 'Not Found' } });
  }

  /**
   * Answer a request to the REST API.
   * @param {string} method HTTP method.
   * @param {string} pathname URL path.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} [searchParams] URL query.
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleREST(method, pathname, body, searchParams = new URLSearchParams()) {
    const repoPath = `/repos/${this.owner}/${this.repo}`;

    if (pathname === '/user') {
      const { id, login, name, email } = this.user;

      return {
        json: { id, login, name, email, avatar_url: '', html_url: `https://github.com/${login}` },
      };
    }

    if (pathname === '/user/repository_invitations') {
      return {
        json: this.invitations.map((fullName) => ({ repository: { full_name: fullName } })),
      };
    }

    if (method === 'GET' && pathname === repoPath) {
      const headers = this.scopes === undefined ? undefined : { 'x-oauth-scopes': this.scopes };

      if (this.rateLimited) {
        return {
          status: 403,
          json: { message: 'API rate limit exceeded' },
          headers: { ...headers, 'x-ratelimit-remaining': '0' },
        };
      }

      // GitHub hides a private repository from someone who can’t read it
      if (!this.canRead) {
        return { status: 404, json: { message: 'Not Found' }, headers };
      }

      return {
        json: {
          full_name: `${this.owner}/${this.repo}`,
          private: false,
          fork: false,
          owner: { login: this.owner, type: 'Organization' },
          default_branch: this.branch,
          allow_forking: this.allowForking,
          permissions: { admin: false, maintain: false, push: this.canWrite, pull: true },
        },
      };
    }

    const forkPath = `/repos/${this.user.login}/${this.fork?.repo ?? this.repo}`;

    if (pathname === forkPath || pathname.startsWith(`${forkPath}/`)) {
      return this.handleForkRequest(method, pathname.slice(forkPath.length + 1), body);
    }

    // Where the CMS looks for a fork first, which isn’t there if the fork has another name
    if (pathname === `/repos/${this.user.login}/${this.repo}`) {
      return { status: 404, json: { message: 'Not Found' } };
    }

    if (!pathname.startsWith(`${repoPath}/`)) {
      return undefined;
    }

    const path = pathname.slice(repoPath.length + 1);
    const segments = path.split('/');

    // A deployment triggered with the Publish Changes button, which GitHub Actions picks up
    if (method === 'POST' && path === 'dispatches') {
      this.dispatches.push(body?.event_type);

      return { status: 204 };
    }

    if (method === 'POST' && path === 'forks') {
      if (!this.allowForking) {
        return { status: 403, json: { message: 'Forking is disabled for this repository' } };
      }

      if (!this.fork) {
        this.createFork();
        this.forkPendingRequests = this.forkDelay;
      }

      const { owner, repo } = /** @type {{ owner: string, repo: string }} */ (this.fork);

      return { status: 202, json: { full_name: `${owner}/${repo}`, fork: true } };
    }

    if (method === 'GET' && path.startsWith('compare/')) {
      return this.handleCompareRequest(path.slice('compare/'.length));
    }

    if (method === 'GET' && path.startsWith('git/trees/')) {
      const ref = decodeURIComponent(path.slice('git/trees/'.length));
      const commit = this.refs.has(ref) ? this.getHead(ref) : this.getCommit(ref);

      if (commit) {
        return this.handleTreeRequest({
          sha: commit.oid,
          tree: commit.tree,
          prefix: '',
          recursive: searchParams.has('recursive'),
          truncate: this.truncateTree,
        });
      }

      const subtree = this.subtrees.get(ref);

      return subtree
        ? this.handleTreeRequest({
            sha: ref,
            ...subtree,
            recursive: searchParams.has('recursive'),
            truncate: false,
          })
        : undefined;
    }

    if (method === 'GET' && path.startsWith('git/blobs/')) {
      const blob = this.blobs.get(path.slice('git/blobs/'.length));

      return blob ? { json: blob } : undefined;
    }

    if (path.startsWith('git/refs/heads/')) {
      return this.handleRefRequest(
        method,
        decodeURIComponent(path.slice('git/refs/heads/'.length)),
        body,
      );
    }

    if (method === 'POST' && path === 'pulls') {
      return this.handleCreatePullRequest(/** @type {Record<string, any>} */ (body));
    }

    if (segments[0] === 'pulls' || segments[0] === 'issues') {
      const pullRequest = this.getPullRequest(Number(segments[1]));

      if (!pullRequest) {
        return undefined;
      }

      return this.handlePullRequestRequest({
        method,
        pullRequest,
        path: `${segments[0]}${segments[2] ? `/${segments.slice(2).join('/')}` : ''}`,
        body: body ?? {},
      });
    }

    return undefined;
  }

  /**
   * Answer a request for a Git tree: the files in a directory of a commit, and those in its
   * subdirectories if the listing is recursive. Without recursion, or when the recursive listing is
   * truncated, a subdirectory is a `tree` entry with a made-up SHA, which can be requested in turn.
   * @param {object} args Arguments.
   * @param {string} args.sha SHA of the commit or the tree.
   * @param {Map<string, string>} args.tree File tree of the commit.
   * @param {string} args.prefix Path of the directory, with a trailing slash, or an empty string
   * for the root.
   * @param {boolean} args.recursive Whether the subdirectories are asked for as well.
   * @param {boolean} args.truncate Whether to truncate a recursive listing, as GitHub does for a
   * tree with too many entries.
   * @returns {MockResponse} Response.
   * @see https://docs.github.com/en/rest/git/trees#get-a-tree
   */
  handleTreeRequest({ sha, tree, prefix, recursive, truncate }) {
    const files = [...tree]
      .filter(([filePath]) => filePath.startsWith(prefix))
      .map(([filePath, blobSHA]) => [filePath.slice(prefix.length), blobSHA]);

    /**
     * Create a `blob` entry.
     * @param {string} filePath Path relative to the directory.
     * @param {string} blobSHA Blob SHA.
     * @returns {Record<string, any>} Entry.
     */
    const toBlobEntry = (filePath, blobSHA) => ({
      path: filePath,
      mode: '100644',
      type: 'blob',
      sha: blobSHA,
      size: this.blobs.get(blobSHA)?.length,
    });

    if (recursive && !truncate) {
      return {
        json: {
          sha,
          tree: files.map(([filePath, blobSHA]) => toBlobEntry(filePath, blobSHA)),
          truncated: false,
        },
      };
    }

    const directories = [
      ...new Set(
        files
          .filter(([filePath]) => filePath.includes('/'))
          .map(([filePath]) => filePath.split('/')[0]),
      ),
    ];

    return {
      json: {
        sha,
        tree: [
          ...files
            .filter(([filePath]) => !filePath.includes('/'))
            .map(([filePath, blobSHA]) => toBlobEntry(filePath, blobSHA)),
          ...directories.map((name) => {
            const treeSHA = createHash('sha1').update(`tree ${sha} ${name}`).digest('hex');

            this.subtrees.set(treeSHA, { tree, prefix: `${prefix}${name}/` });

            return { path: name, mode: '040000', type: 'tree', sha: treeSHA };
          }),
        ],
        truncated: recursive,
      },
    };
  }

  /**
   * Answer a request to the signed-in user’s fork. Like GitHub, answer 404 for a fork that doesn’t
   * exist, which is how the CMS finds out it has to make one.
   * @param {string} method HTTP method.
   * @param {string} path URL path relative to the fork, e.g. `merge-upstream`, or an empty string
   * for the fork itself.
   * @param {Record<string, any> | null} body Request body.
   * @returns {MockResponse | undefined} Response.
   */
  handleForkRequest(method, path, body) {
    if (!this.fork) {
      return { status: 404, json: { message: 'Not Found' } };
    }

    if (this.forkPendingRequests > 0) {
      this.forkPendingRequests -= 1;

      return { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && path === '') {
      return {
        json: {
          full_name: `${this.fork.owner}/${this.fork.repo}`,
          fork: true,
          parent: { full_name: `${this.owner}/${this.repo}` },
          owner: { login: this.fork.owner, type: 'User' },
        },
      };
    }

    // Fast-forward the fork’s copy of a branch to the repository’s
    // @see https://docs.github.com/en/rest/branches/branches#sync-a-fork-branch-with-the-upstream-repository
    if (method === 'POST' && path === 'merge-upstream') {
      const forkBranch = this.forkBranch(body?.branch);
      const current = this.refs.get(forkBranch);
      const upstream = /** @type {string} */ (this.refs.get(body?.branch));

      if (current === upstream) {
        return { json: { merge_type: 'none', message: 'This branch is not behind the upstream' } };
      }

      if (!current || !this.getAncestors(upstream).some(({ oid }) => oid === current)) {
        return { status: 409, json: { message: 'There are merge conflicts' } };
      }

      this.refs.set(forkBranch, upstream);

      return {
        json: { merge_type: 'fast-forward', message: 'Successfully fetched and fast-forwarded' },
      };
    }

    if (path.startsWith('git/refs/heads/')) {
      return this.handleRefRequest(
        method,
        this.forkBranch(decodeURIComponent(path.slice('git/refs/heads/'.length))),
        body,
      );
    }

    if (method === 'GET' && path.startsWith('git/blobs/')) {
      const blob = this.blobs.get(path.slice('git/blobs/'.length));

      return blob ? { json: blob } : undefined;
    }

    return undefined;
  }

  /**
   * Answer a request to compare two branches, possibly across repositories, or a branch with a
   * commit, with the files the head changes since the merge base, like GitHub’s “Files changed”.
   * @param {string} range Encoded range, e.g. `main...mona:cms/mona/e2e-site/posts/hello` or
   * `main...<oid>`.
   * @returns {MockResponse} Response.
   * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
   */
  handleCompareRequest(range) {
    const [baseRef, headRef] = range.split('...').map((ref) => decodeURIComponent(ref));

    const [base, head] = [baseRef, headRef].map((ref) => {
      const { owner, name } = splitBranchKey(ref);

      return this.toBranchKey(owner, name);
    });

    const headCommit = this.refs.has(head) ? this.getHead(head) : this.getCommit(headRef);

    if (!this.refs.has(base) || !headCommit) {
      return { status: 404, json: { message: 'Not Found' } };
    }

    const mergeBase = this.getMergeBase(headCommit.oid, this.getHead(base).oid);
    /** @type {Record<string, string>} */
    const statuses = { ADDED: 'added', MODIFIED: 'modified', DELETED: 'removed' };

    return {
      json: {
        files: MockGitHub.diffTrees(mergeBase.tree, headCommit.tree).map(
          ({ path, changeType }) => ({
            filename: path,
            status: statuses[changeType],
          }),
        ),
      },
    };
  }

  /**
   * Answer a request to update or delete a branch.
   * @param {string} method HTTP method.
   * @param {string} branch Branch name.
   * @param {Record<string, any> | null} body Request body.
   * @returns {MockResponse | undefined} Response.
   * @see https://docs.github.com/en/rest/git/refs
   */
  handleRefRequest(method, branch, body) {
    if (!this.refs.has(branch)) {
      return { status: 422, json: { message: 'Reference does not exist' } };
    }

    if (method === 'DELETE') {
      this.deleteBranch(branch);

      return { status: 204 };
    }

    if (method === 'PATCH' && body) {
      const current = /** @type {string} */ (this.refs.get(branch));

      if (!this.getCommit(body.sha)) {
        return { status: 422, json: { message: 'Object does not exist' } };
      }

      // Without `force`, only a fast-forward is allowed
      if (!body.force && !this.getAncestors(body.sha).some(({ oid }) => oid === current)) {
        return { status: 422, json: { message: 'Update is not a fast forward' } };
      }

      this.refs.set(branch, body.sha);

      return { json: { ref: `refs/heads/${branch}`, object: { sha: body.sha, type: 'commit' } } };
    }

    return undefined;
  }

  /**
   * Answer a request to open a pull request. Like GitHub, refuse one from a branch that doesn’t
   * exist, has nothing to merge, or already has an open pull request.
   * @param {Record<string, any>} body Request body.
   * @returns {MockResponse} Response.
   * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
   */
  handleCreatePullRequest({ title, head, base, draft = false, body = '' }) {
    /**
     * Create a validation error response.
     * @param {string} message Error message.
     * @returns {MockResponse} Response.
     */
    const refuse = (message) => ({
      status: 422,
      json: { message: 'Validation Failed', errors: [{ resource: 'PullRequest', message }] },
    });

    if (!this.refs.has(head) || !this.refs.has(base)) {
      return refuse(`Branch ${this.refs.has(head) ? base : head} doesn’t exist`);
    }

    if (this.getOpenPullRequest(head, base)) {
      return refuse(`A pull request already exists for ${this.owner}:${head}.`);
    }

    const headOid = this.getHead(head).oid;

    if (this.getAncestors(this.getHead(base).oid).some(({ oid }) => oid === headOid)) {
      return refuse(`No commits between ${base} and ${head}`);
    }

    const pullRequest = this.openPullRequest({
      title,
      head,
      base,
      draft,
      body,
      author: this.user,
    });

    return { status: 201, json: this.toRestPullRequest(pullRequest) };
  }

  /**
   * Answer a request about a pull request, or the issue it is.
   * @param {object} args Arguments.
   * @param {string} args.method HTTP method.
   * @param {MockPullRequest} args.pullRequest Pull request.
   * @param {string} args.path Request path relative to the repository, with the number removed,
   * e.g. `pulls/merge` or `issues/labels`.
   * @param {Record<string, any>} args.body Request body.
   * @returns {MockResponse | undefined} Response.
   */
  handlePullRequestRequest({ method, pullRequest, path, body }) {
    const request = `${method} ${path}`;

    if (request === 'GET pulls' || request === 'GET issues') {
      return { json: this.toRestPullRequest(pullRequest) };
    }

    if (request === 'PATCH pulls' || request === 'PATCH issues') {
      if (body.state === 'open' && pullRequest.state !== 'open') {
        if (pullRequest.state === 'merged' || !this.refs.has(pullRequest.head)) {
          return { status: 422, json: { message: 'Validation Failed' } };
        }
      }

      if (body.state === 'closed' && pullRequest.state === 'open') {
        Object.assign(pullRequest, { lastHead: this.refs.get(pullRequest.head) });
      }

      Object.assign(pullRequest, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.state !== undefined && pullRequest.state !== 'merged'
          ? { state: body.state }
          : {}),
        ...(body.labels !== undefined ? { labels: [...new Set(body.labels)] } : {}),
        updatedAt: new Date(),
      });

      return { json: this.toRestPullRequest(pullRequest) };
    }

    if (request === 'POST issues/labels') {
      pullRequest.labels = [...new Set([...pullRequest.labels, ...body.labels])];
      pullRequest.updatedAt = new Date();

      return { json: pullRequest.labels.map((name) => ({ name })) };
    }

    if (request === 'PUT pulls/merge') {
      // Like GitHub, refuse a merge pinned to a commit the branch no longer points at
      if (body.sha && body.sha !== this.getPullRequestHead(pullRequest).oid) {
        return {
          status: 409,
          json: { message: 'Head branch was modified. Review and try the merge again.' },
        };
      }

      const commit = this.mergePullRequest(pullRequest, {
        method: body.merge_method,
        title: body.commit_title,
        author: this.user,
      });

      return commit
        ? { json: { sha: commit.oid, merged: true, message: 'Pull Request successfully merged' } }
        : { status: 405, json: { message: 'Pull Request is not mergeable' } };
    }

    return undefined;
  }

  /**
   * Convert a pull request to the REST API’s representation.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {Record<string, any>} Pull request object.
   */
  toRestPullRequest(pullRequest) {
    const { number, nodeId, title, body, state, draft, labels, createdAt, updatedAt } = pullRequest;
    const { owner: headOwner, name: headName } = splitBranchKey(pullRequest.head);
    const headCommit = this.getPullRequestHead(pullRequest);

    return {
      number,
      node_id: nodeId,
      title,
      body,
      state: state === 'merged' ? 'closed' : state,
      merged: state === 'merged',
      draft,
      html_url: `https://github.com/${this.owner}/${this.repo}/pull/${number}`,
      head: {
        ref: headName,
        sha: headCommit.oid,
        // A branch in the fork is keyed by the fork’s owner
        repo: {
          full_name: headOwner
            ? `${headOwner}/${this.fork?.repo ?? this.repo}`
            : `${this.owner}/${this.repo}`,
        },
      },
      base: { ref: pullRequest.base, repo: { full_name: `${this.owner}/${this.repo}` } },
      labels: labels.map((name) => ({ name })),
      user: { login: pullRequest.author.login, id: pullRequest.author.id },
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
    };
  }

  /**
   * Convert a pull request to a GraphQL `PullRequest` node, with the fields the CMS asks for.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {Record<string, any>} Node.
   */
  toPullRequestNode(pullRequest) {
    const { number, nodeId, title, state, draft, labels, createdAt, updatedAt, author } =
      pullRequest;

    const { owner: headOwner, name: headRefName } = splitBranchKey(pullRequest.head);

    return {
      id: nodeId,
      number,
      title,
      url: `https://github.com/${this.owner}/${this.repo}/pull/${number}`,
      state: state.toUpperCase(),
      isDraft: draft,
      isCrossRepository: !!headOwner,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      headRefName,
      baseRefName: pullRequest.base,
      headRepositoryOwner: { login: headOwner ?? this.owner },
      headRefOid: this.getPullRequestHead(pullRequest).oid,
      author: {
        login: author.login,
        avatarUrl: '',
        name: author.name,
        email: author.email,
        databaseId: author.id,
      },
      labels: { nodes: labels.map((name) => ({ name })) },
      files: { nodes: this.getPullRequestFiles(pullRequest) },
    };
  }

  /**
   * Answer a GraphQL query.
   * @param {string} query Query.
   * @param {Record<string, any>} variables Variables.
   * @returns {Record<string, any> | undefined} Response body, or `undefined` if the query isn’t
   * mocked.
   */
  handleGraphQL(query, variables) {
    if (query.includes('createCommitOnBranch')) {
      return this.createCommitOnBranch(query, variables.input);
    }

    if (query.includes('createRef(')) {
      return this.createRef(variables.input);
    }

    const draftMutation = query.match(
      /(convertPullRequestToDraft|markPullRequestReadyForReview)\(/,
    );

    if (draftMutation) {
      const [, mutation] = draftMutation;

      const pullRequest = this.pullRequests.find(
        ({ nodeId }) => nodeId === variables.input.pullRequestId,
      );

      if (!pullRequest) {
        return {
          data: { [mutation]: null },
          errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a node' }],
        };
      }

      pullRequest.draft = mutation === 'convertPullRequestToDraft';
      pullRequest.updatedAt = new Date();

      return { data: { [mutation]: { pullRequest: { isDraft: pullRequest.draft } } } };
    }

    // The state of a pull request, read before an Open Authoring contributor changes it, along with
    // what tells whether it’s still the entry’s
    if (/node\(id:\s*\$id\)\s*\{\s*\.\.\.\s*on\s+PullRequest\b/.test(query)) {
      const pullRequest = this.pullRequests.find(({ nodeId }) => nodeId === variables.id);

      return {
        data: {
          node: pullRequest
            ? {
                state: pullRequest.state.toUpperCase(),
                isDraft: pullRequest.draft,
                baseRefName: pullRequest.base,
                headRefOid: this.getPullRequestHead(pullRequest).oid,
                headRepositoryOwner: {
                  login: splitBranchKey(pullRequest.head).owner ?? this.owner,
                },
                author: { login: pullRequest.author.login },
              }
            : null,
        },
      };
    }

    if (query.includes('defaultBranchRef')) {
      return { data: { repository: { defaultBranchRef: { name: this.branch } } } };
    }

    if (query.includes('refUpdateRule')) {
      return { data: { repository: { ref: { refUpdateRule: this.branchRule } } } };
    }

    // The fork the signed-in user owns, looked for when it isn’t found at the default name
    if (query.includes('forks(')) {
      const { fork } = this;

      return {
        data: {
          repository: {
            forks: {
              nodes: fork
                ? [{ nameWithOwner: `${fork.owner}/${fork.repo}`, owner: { login: fork.owner } }]
                : [],
            },
          },
        },
      };
    }

    // The Editorial Workflow branches in the fork
    if (query.includes('refs(refPrefix:')) {
      return { data: { repository: { refs: { nodes: this.findForkBranches(variables) } } } };
    }

    // The repository to create a workflow branch in, and the head of the branch to start it from
    if (/fork:\s*repository\(/.test(query)) {
      const { forkOwner, forkRepo } = variables;
      const isFork = forkOwner === this.fork?.owner && forkRepo === this.fork?.repo;

      return {
        data: {
          fork:
            forkOwner === this.owner && forkRepo === this.repo
              ? { id: this.repositoryId }
              : isFork
                ? { id: this.forkId }
                : null,
          base: { ref: this.getRefNode(variables.branch, { oid: true }) },
        },
      };
    }

    // The head of a single branch, which a save reads to find out whether the workflow branch has
    // moved since its own last commit. The branch lives in the fork with Open Authoring, so it’s
    // keyed by the owner the query names
    if (/branchHead:\s*ref\(qualifiedName:/.test(query)) {
      const key = this.toBranchKey(variables.owner, toBranchName(variables.branch));

      return { data: { repository: { branchHead: this.getRefNode(key, { oid: true }) } } };
    }

    // The pull requests opened from each fork branch to the configured branch, fetched in batches
    // with an alias for each. The base branch is optional, so a query without it is still answered
    // rather than silently falling through to the connection below
    const branchPullRequests = [
      ...query.matchAll(
        new RegExp(
          `(pr_\\d+):\\s*pullRequests\\(\\s*headRefName:\\s*${STRING}` +
            `(?:\\s*baseRefName:\\s*${STRING})?`,
          'g',
        ),
      ),
    ];

    if (branchPullRequests.length) {
      return {
        data: {
          repository: Object.fromEntries(
            branchPullRequests.map(([, alias, name, baseName]) => [
              alias,
              {
                nodes: this.pullRequests
                  .filter(
                    ({ head, base }) =>
                      splitBranchKey(head).name === JSON.parse(name) &&
                      (!baseName || base === JSON.parse(baseName)),
                  )
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                  .slice(0, 2)
                  .map((pullRequest) => this.toPullRequestNode(pullRequest)),
              },
            ]),
          ),
        },
      };
    }

    if (query.includes('pullRequests(')) {
      return {
        data: { repository: { pullRequests: { nodes: this.findPullRequests(query, variables) } } },
      };
    }

    // A query about the fork addresses its branches, which are keyed with its owner
    const branch = this.toBranchKey(variables.owner, toBranchName(variables.branch ?? this.branch));
    /** @type {Record<string, any>} */
    const repository = {};

    // File contents, fetched in batches with an alias for each file, and the builds of a commit,
    // which the CMS shows with the deployment status: those reported with `reportBuild()`, or none.
    // Like GitHub, answer `null` for an object that doesn’t exist
    query
      .matchAll(/(\w+_\d+):\s*object\(oid:\s*"(\w+)"\)\s*\{\s*\.\.\.\s*on\s+(Blob|Commit)\b/g)
      .forEach(([, alias, sha, type]) => {
        if (type === 'Blob') {
          const blob = this.blobs.get(sha);

          repository[alias] = blob ? { text: blob.toString(), isTruncated: false } : null;
        } else {
          repository[alias] = this.getCommit(sha) ? this.toBuildNodes(sha) : null;
        }
      });

    // Files on a branch or at a commit, as `branch:path` or `oid:path` expressions, fetched in
    // batches the same way
    query
      .matchAll(new RegExp(`(\\w+_\\d+):\\s*object\\(expression:\\s*${STRING}\\)`, 'g'))
      .forEach(([, alias, expression]) => {
        const [name, ...rest] = JSON.parse(expression).split(':');
        const ref = this.toBranchKey(variables.owner, name);
        const tree = this.refs.has(ref) ? this.getHead(ref).tree : this.getCommit(name)?.tree;
        const sha = tree?.get(rest.join(':'));
        const blob = sha ? this.blobs.get(sha) : undefined;

        repository[alias] = blob
          ? {
              oid: sha,
              byteSize: blob.length,
              isBinary: blob.includes(0),
              isTruncated: false,
              text: blob.includes(0) ? null : blob.toString(),
            }
          : null;
      });

    // The entries of folders at a commit, as `oid:path` expressions, which give the file modes.
    // Every file in the mock is a regular one. Like GitHub, answer `null` for a missing folder
    query
      .matchAll(
        new RegExp(
          `(\\w+_\\d+):\\s*object\\(expression:\\s*${STRING}\\)\\s*\\{\\s*\\.\\.\\.\\s*on\\s+Tree`,
          'g',
        ),
      )
      .forEach(([, alias, expression]) => {
        const [oid, ...rest] = JSON.parse(expression).split(':');
        const dir = rest.join(':');
        const prefix = dir ? `${dir}/` : '';
        const tree = this.getCommit(oid)?.tree;

        const names = [...(tree?.keys() ?? [])]
          .filter((path) => path.startsWith(prefix))
          .map((path) => path.slice(prefix.length).split('/')[0]);

        repository[alias] = names.length
          ? { entries: [...new Set(names)].map((name) => ({ name, mode: 33188 })) }
          : null;
      });

    // Commit history of a file, fetched in batches the same way
    query
      .matchAll(
        new RegExp(
          `(\\w+_\\d+):\\s*ref[^]*?history\\(first:\\s*(\\d+),\\s*path:\\s*${STRING}\\)`,
          'g',
        ),
      )
      .forEach(([, alias, first, path]) => {
        repository[alias] = this.refs.has(branch)
          ? {
              target: {
                history: { nodes: this.getHistory(branch, JSON.parse(path), Number(first)) },
              },
            }
          : null;
      });

    if (Object.keys(repository).length) {
      return { data: { repository } };
    }

    // The head of a branch
    if (/on Commit\s*\{\s*oid\s*\}/.test(query)) {
      return { data: { repository: { ref: this.getRefNode(branch, { oid: true }) } } };
    }

    // The latest commit on a branch
    if (/history\(first:\s*1\)/.test(query)) {
      return { data: { repository: { ref: this.getRefNode(branch, { history: true }) } } };
    }

    return undefined;
  }

  /**
   * Get a GraphQL `Ref` node for a branch.
   * @param {string} ref Branch name, qualified or not, or a fork branch key.
   * @param {object} fields Fields to include on the target commit.
   * @param {boolean} [fields.oid] Whether to include the commit SHA.
   * @param {boolean} [fields.history] Whether to include the latest commit as `history`.
   * @returns {Record<string, any> | null} Node, or `null` if the branch doesn’t exist.
   */
  getRefNode(ref, { oid = false, history = false }) {
    const branch = toBranchName(ref);

    if (!this.refs.has(branch)) {
      return null;
    }

    const head = this.getHead(branch);

    return {
      target: {
        ...(oid ? { oid: head.oid } : {}),
        ...(history ? { history: { nodes: [{ oid: head.oid, message: head.message }] } } : {}),
      },
    };
  }

  /**
   * Find the pull requests a `pullRequests` connection asks for. The CMS filters open pull requests
   * by their status labels, or by their head branch.
   * @param {string} query Query.
   * @param {Record<string, any>} variables Variables.
   * @returns {Record<string, any>[]} Pull request nodes, the most recently updated first.
   */
  findPullRequests(query, variables) {
    const [, args] = /** @type {RegExpMatchArray} */ (query.match(/pullRequests\(([^)]*)\)/));
    const states = args.match(/states:\s*(\w+)/)?.[1];
    const labels = args.match(/labels:\s*(\[[^\]]*\])/)?.[1];
    const headRefName = /headRefName:\s*\$branch/.test(args) ? variables.branch : undefined;

    return this.pullRequests
      .filter(
        (pullRequest) =>
          (!states || pullRequest.state.toUpperCase() === states) &&
          (!labels ||
            JSON.parse(labels).some((/** @type {string} */ label) =>
              pullRequest.labels.includes(label),
            )) &&
          (!headRefName || splitBranchKey(pullRequest.head).name === headRefName),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((pullRequest) => this.toPullRequestNode(pullRequest));
  }

  /**
   * Find the Editorial Workflow branches in the fork, as the `refs` of a GraphQL `Repository`.
   * @param {Record<string, any>} variables Query variables, with the fork’s `owner` and the
   * qualified `prefix` of the branch names, e.g. `refs/heads/cms/mona/e2e-site/`.
   * @returns {Record<string, any>[]} Ref nodes, named without the prefix, in alphabetical order
   * like on GitHub.
   */
  findForkBranches({ owner, prefix }) {
    const keyPrefix = this.toBranchKey(owner, toBranchName(prefix));

    return [...this.refs.keys()]
      .filter((key) => key.startsWith(keyPrefix))
      .sort()
      .map((key) => {
        const { oid, message, date, author } = this.getHead(key);

        return {
          name: key.slice(keyPrefix.length),
          target: {
            oid,
            message,
            committedDate: date.toISOString(),
            author: {
              name: author.name,
              email: author.email,
              user: author.login ? { login: author.login, databaseId: author.id } : null,
            },
          },
        };
      });
  }

  /**
   * Get the commits on a branch that changed a file, the latest first, as the `history` of a
   * GraphQL `Commit`.
   * @param {string} branch Branch name.
   * @param {string} path File path.
   * @param {number} first Maximum number of commits.
   * @returns {Record<string, any>[]} Commit nodes.
   */
  getHistory(branch, path, first) {
    if (this.pathsWithoutHistory.has(path)) {
      return [];
    }

    return this.getAncestors(this.getHead(branch).oid)
      .filter(({ paths, parents }) => paths.has(path) && parents.length < 2)
      .slice(0, first)
      .map(({ oid, author, date }) => ({
        oid,
        author: {
          name: author.name,
          email: author.email,
          avatarUrl: '',
          user: author.login ? { id: author.id, login: author.login } : null,
        },
        committedDate: date.toISOString(),
      }));
  }

  /**
   * Handle the `createRef` mutation. Like GitHub, refuse to create a branch that already exists.
   * @param {Record<string, any>} input Mutation input.
   * @returns {Record<string, any>} Response body.
   */
  createRef({ repositoryId, name, oid }) {
    const branch = toBranchName(name);
    const key = repositoryId === this.forkId ? this.forkBranch(branch) : branch;

    if (!this.getCommit(oid)) {
      return {
        data: { createRef: null },
        errors: [{ type: 'UNPROCESSABLE', message: 'Object does not exist' }],
      };
    }

    if (!this.createBranch(key, oid)) {
      return {
        data: { createRef: null },
        errors: [
          {
            type: 'UNPROCESSABLE',
            message: `A ref named "${name}" already exists in the repository.`,
          },
        ],
      };
    }

    return { data: { createRef: { ref: { name } } } };
  }

  /**
   * Handle the `createCommitOnBranch` mutation. Like GitHub, refuse the commit if the branch has
   * moved since the CMS loaded it, or doesn’t exist.
   * @param {string} query Mutation, which asks for the SHA of each added file with an alias.
   * @param {Record<string, any>} input Mutation input.
   * @returns {Record<string, any>} Response body.
   */
  createCommitOnBranch(query, input) {
    this.received.push(input);

    const { beforeCommit } = this;
    const [owner] = input.branch.repositoryNameWithOwner.split('/');
    const branchName = this.toBranchKey(owner, input.branch.branchName);

    this.beforeCommit = undefined;
    beforeCommit?.();

    if (!this.refs.has(branchName)) {
      return {
        data: { createCommitOnBranch: null },
        errors: [{ type: 'NOT_FOUND', message: `Could not resolve to a Ref "${branchName}".` }],
      };
    }

    if (input.expectedHeadOid !== this.getHead(branchName).oid) {
      return {
        data: { createCommitOnBranch: null },
        errors: [
          {
            type: 'STALE_DATA',
            message: `Expected branch to point to "${input.expectedHeadOid}" but it did not.`,
          },
        ],
      };
    }

    const { additions = [], deletions = [] } = input.fileChanges;

    const commit = this.commit(
      Object.fromEntries([
        ...additions.map(({ path, contents }) => [path, Buffer.from(contents, 'base64')]),
        ...deletions.map(({ path }) => [path, null]),
      ]),
      { message: input.message.headline, author: this.user, branch: branchName },
    );

    // The commit shows up on every pull request the branch is the head of
    this.getOpenPullRequests(branchName).forEach((pullRequest) => {
      pullRequest.updatedAt = commit.date;
    });

    /** @type {Record<string, any>} */
    const result = { oid: commit.oid, committedDate: commit.date.toISOString() };

    query
      .matchAll(new RegExp(`(file_\\d+):\\s*file\\(path:\\s*${STRING}\\)`, 'g'))
      .forEach(([, alias, path]) => {
        result[alias] = { oid: commit.tree.get(JSON.parse(path)) };
      });

    return { data: { createCommitOnBranch: { commit: result } } };
  }
}
