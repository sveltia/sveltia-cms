import { createHash } from 'crypto';

/**
 * @import { Page, Route } from '@playwright/test';
 */

/**
 * @typedef {object} MockCommit
 * @property {string} oid Commit SHA.
 * @property {string} message Commit message.
 * @property {Date} date Commit date.
 * @property {{ name: string, email: string, login?: string, id?: number }} author Commit author.
 * @property {Map<string, string>} tree Blob SHA keyed by file path, as of this commit.
 * @property {Set<string>} paths Paths of the files added, updated or deleted in this commit.
 * @property {string[]} parents SHAs of the parent commits: none for the initial commit, two for a
 * merge commit.
 */

/**
 * @typedef {object} MockUser
 * @property {number} id User ID.
 * @property {string} login User name.
 * @property {string} name Display name.
 * @property {string} email Email address.
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
 * @typedef {object} MockResponse
 * @property {number} [status] HTTP status, 200 by default.
 * @property {any} [json] Response body.
 */

/**
 * Pattern of a string literal in a GraphQL query, as the CMS writes one with `JSON.stringify()`.
 * The patterns below allow for any whitespace, as the CMS collapses it before sending a query.
 */
const STRING = '("(?:[^"\\\\]|\\\\.)*")';

/**
 * Calculate the Git blob SHA of a file, like `git hash-object` does, so the SHAs match what the CMS
 * calculates for the files it saves.
 * @param {Buffer} content File content.
 * @returns {string} SHA-1 hash.
 */
const getBlobSHA = (content) =>
  createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');

/**
 * Strip the `refs/heads/` prefix from a qualified ref name, which the GraphQL API accepts along
 * with a bare branch name.
 * @param {string} ref Ref name, e.g. `refs/heads/main` or `main`.
 * @returns {string} Branch name.
 */
const toBranchName = (ref) => ref.replace(/^refs\/heads\//, '');

/**
 * A GitHub repository behind a mocked REST and GraphQL API, for the CMS to sign in to, load files
 * from and commit to. A test can commit to it as someone else with {@link MockGitHub.commit} to
 * simulate a colleague’s change, and check what the CMS committed in {@link MockGitHub.received}.
 * Branches and pull requests work as well, with labels and the draft state, for Editorial Workflow.
 */
export class MockGitHub {
  owner = 'sveltia';

  repo = 'e2e-site';

  /**
   * The default branch, which the CMS is configured with.
   */
  branch = 'main';

  /**
   * GraphQL node ID of the repository.
   */
  repositoryId = 'R_e2e';

  /**
   * The signed-in user.
   * @type {MockUser}
   */
  user = { id: 1, login: 'mona', name: 'Mona Lisa', email: 'mona@example.com' };

  /**
   * Someone else committing to the repository with {@link commit}.
   * @type {MockUser}
   */
  colleague = { id: 2, login: 'alex', name: 'Alex Kim', email: 'alex@example.com' };

  /**
   * File content keyed by blob SHA, for every version of every file.
   * @type {Map<string, Buffer>}
   */
  blobs = new Map();

  /**
   * Every commit on any branch, the oldest first.
   * @type {MockCommit[]}
   */
  commits = [];

  /**
   * Head commit SHA keyed by branch name.
   * @type {Map<string, string>}
   */
  refs = new Map();

  /**
   * Pull requests, open or not, the oldest first.
   * @type {MockPullRequest[]}
   */
  pullRequests = [];

  /**
   * The `createCommitOnBranch` inputs the CMS has sent, whether accepted or not.
   * @type {Record<string, any>[]}
   */
  received = [];

  /**
   * Function called once when the CMS next commits, before the commit is made, e.g. to commit
   * something else first and make the branch move under the CMS.
   * @type {(() => void) | undefined}
   */
  beforeCommit = undefined;

  /**
   * Requests the mock couldn’t answer. The fixture fails the test if there is any, so a change in
   * what the CMS requests is noticed rather than ending in a timeout.
   * @type {string[]}
   */
  unhandled = [];

  /**
   * Create a repository with an empty initial commit on the default branch.
   */
  constructor() {
    this.commit({}, { message: 'Initial commit' });
  }

  /**
   * The latest commit on the default branch.
   * @type {MockCommit}
   */
  get head() {
    return this.getHead(this.branch);
  }

  /**
   * Get a commit by its SHA.
   * @param {string} oid Commit SHA.
   * @returns {MockCommit | undefined} Commit.
   */
  getCommit(oid) {
    return this.commits.find((commit) => commit.oid === oid);
  }

  /**
   * Get the latest commit on a branch.
   * @param {string} branch Branch name.
   * @returns {MockCommit} Commit.
   * @throws {Error} When the branch doesn’t exist.
   */
  getHead(branch) {
    const oid = this.refs.get(branch);
    const commit = oid ? this.getCommit(oid) : undefined;

    if (!commit) {
      throw new Error(`Branch ${branch} doesn’t exist`);
    }

    return commit;
  }

  /**
   * Add a commit to the repository, without moving any branch.
   * @param {object} args Arguments.
   * @param {Map<string, string>} args.tree File tree.
   * @param {Iterable<string>} args.paths Paths changed by the commit.
   * @param {string} args.message Commit message.
   * @param {MockUser} args.author Author.
   * @param {string[]} args.parents Parent commit SHAs.
   * @returns {MockCommit} New commit.
   */
  addCommit({ tree, paths, message, author, parents }) {
    const latest = this.commits.at(-1);

    /** @type {MockCommit} */
    const commit = {
      oid: createHash('sha1').update(`commit ${this.commits.length} ${message}`).digest('hex'),
      message,
      // At least a second apart, so their order is clear from the dates
      date: new Date(Math.max(Date.now(), (latest?.date.getTime() ?? 0) + 1000)),
      author,
      tree,
      paths: new Set(paths),
      parents,
    };

    this.commits.push(commit);

    return commit;
  }

  /**
   * Commit files to a branch.
   * @param {Record<string, string | Buffer | null>} files File content keyed by path; `null`
   * deletes the file.
   * @param {object} [options] Options.
   * @param {string} [options.message] Commit message.
   * @param {MockUser} [options.author] Author, the colleague by default.
   * @param {string} [options.branch] Branch, the default branch by default. It has to exist,
   * except for the initial commit.
   * @returns {MockCommit} New commit.
   * @throws {Error} When the branch doesn’t exist.
   */
  commit(files, { message = 'Update files', author = this.colleague, branch = this.branch } = {}) {
    const parent = this.refs.has(branch) ? this.getHead(branch) : undefined;

    if (!parent && this.commits.length) {
      throw new Error(`Branch ${branch} doesn’t exist`);
    }

    const tree = new Map(parent?.tree);

    Object.entries(files).forEach(([path, content]) => {
      if (content === null) {
        tree.delete(path);
      } else {
        const buffer = Buffer.from(content);
        const sha = getBlobSHA(buffer);

        this.blobs.set(sha, buffer);
        tree.set(path, sha);
      }
    });

    const commit = this.addCommit({
      tree,
      paths: Object.keys(files),
      message,
      author,
      parents: parent ? [parent.oid] : [],
    });

    this.refs.set(branch, commit.oid);

    return commit;
  }

  /**
   * Get the content of a file on a branch.
   * @param {string} path File path.
   * @param {string} [branch] Branch, the default branch by default.
   * @returns {string | undefined} File content, or `undefined` if the file or the branch doesn’t
   * exist.
   */
  readFile(path, branch = this.branch) {
    if (!this.refs.has(branch)) {
      return undefined;
    }

    const sha = this.getHead(branch).tree.get(path);

    return sha ? this.blobs.get(sha)?.toString() : undefined;
  }

  /**
   * Get a commit and all of its ancestors, the latest first.
   * @param {string} oid Commit SHA.
   * @returns {MockCommit[]} Commits.
   */
  getAncestors(oid) {
    /** @type {Set<string>} */
    const seen = new Set();
    const queue = [oid];

    while (queue.length) {
      const current = /** @type {string} */ (queue.shift());

      if (!seen.has(current)) {
        seen.add(current);
        queue.push(...(this.getCommit(current)?.parents ?? []));
      }
    }

    return this.commits.filter((commit) => seen.has(commit.oid)).reverse();
  }

  /**
   * Find the merge base of two commits: their latest common ancestor.
   * @param {string} a Commit SHA.
   * @param {string} b Commit SHA.
   * @returns {MockCommit} Merge base. Every commit descends from the initial commit, so there’s
   * always one.
   */
  getMergeBase(a, b) {
    const ancestorsOfB = new Set(this.getAncestors(b).map(({ oid }) => oid));

    return /** @type {MockCommit} */ (
      this.getAncestors(a).find(({ oid }) => ancestorsOfB.has(oid))
    );
  }

  /**
   * Compare two file trees.
   * @param {Map<string, string>} before Tree before.
   * @param {Map<string, string>} after Tree after.
   * @returns {{ path: string, changeType: 'ADDED' | 'MODIFIED' | 'DELETED' }[]} Changed files.
   */
  static diffTrees(before, after) {
    return [...new Set([...before.keys(), ...after.keys()])]
      .filter((path) => before.get(path) !== after.get(path))
      .sort()
      .map((path) => ({
        path,

        changeType: !before.has(path) ? 'ADDED' : !after.has(path) ? 'DELETED' : 'MODIFIED',
      }));
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
   * Get the head commit of a pull request. A closed pull request can have lost its branch, in which
   * case the merge commit or the last commit known to it stands in.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {MockCommit} Commit.
   */
  getPullRequestHead(pullRequest) {
    return this.refs.has(pullRequest.head)
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
   * Find the open pull request from a branch.
   * @param {string} branch Head branch name.
   * @returns {MockPullRequest | undefined} Pull request.
   */
  getOpenPullRequest(branch) {
    return this.pullRequests.find(({ head, state }) => head === branch && state === 'open');
  }

  /**
   * Create a branch pointing at a commit.
   * @param {string} branch Branch name.
   * @param {string} oid Commit SHA.
   * @returns {boolean} Whether the branch was created: it isn’t if it already exists.
   */
  createBranch(branch, oid) {
    if (this.refs.has(branch)) {
      return false;
    }

    this.refs.set(branch, oid);

    return true;
  }

  /**
   * Delete a branch. Like GitHub’s automatic head branch deletion, this also happens to the branch
   * of a merged pull request when the test says so.
   * @param {string} branch Branch name.
   * @returns {boolean} Whether the branch existed.
   */
  deleteBranch(branch) {
    const pullRequest = this.getOpenPullRequest(branch);

    // GitHub closes an open pull request whose head branch is deleted
    if (pullRequest) {
      Object.assign(pullRequest, {
        state: 'closed',
        lastHead: this.refs.get(branch),
        updatedAt: new Date(),
      });
    }

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

    const head = this.getHead(pullRequest.head);
    const baseHead = this.getHead(pullRequest.base);
    const mergeBase = this.getMergeBase(head.oid, baseHead.oid);
    const tree = new Map(baseHead.tree);
    /** @type {string[]} */
    const paths = [];

    const conflict = MockGitHub.diffTrees(mergeBase.tree, head.tree).some(({ path }) => {
      const theirs = head.tree.get(path);

      if (baseHead.tree.get(path) !== mergeBase.tree.get(path)) {
        // Changed on both sides: fine only if they made the same change
        return baseHead.tree.get(path) !== theirs;
      }

      if (theirs === undefined) {
        tree.delete(path);
      } else {
        tree.set(path, theirs);
      }

      paths.push(path);

      return false;
    });

    if (conflict) {
      return undefined;
    }

    const commit = this.addCommit({
      tree,
      paths,
      message: title ?? pullRequest.title,
      author,
      parents: method === 'squash' ? [baseHead.oid] : [baseHead.oid, head.oid],
    });

    this.refs.set(pullRequest.base, commit.oid);
    Object.assign(pullRequest, {
      state: 'merged',
      mergeCommit: commit.oid,
      lastHead: head.oid,
      updatedAt: new Date(),
    });

    return commit;
  }

  /**
   * Route the GitHub requests of a page to the mock, and store a session for the user, so the CMS
   * signs in on its own when the page is opened.
   * @param {Page} page Page.
   */
  async install(page) {
    await page.addInitScript((user) => {
      localStorage.setItem('sveltia-cms.user', JSON.stringify(user));
    }, this.getUserProfile());

    await page.route('https://api.github.com/**', (route) => this.handleRoute(route));
    await page.route('https://www.githubstatus.com/**', (route) =>
      route.fulfill({ json: { status: { indicator: 'none' } } }),
    );
    await page.route('https://avatars.githubusercontent.com/**', (route) =>
      route.fulfill({ status: 404 }),
    );
  }

  /**
   * Get the user profile the CMS stores for a signed-in user.
   * @returns {Record<string, any>} Profile.
   */
  getUserProfile() {
    const { id, login, name, email } = this.user;

    return { backendName: 'github', id, login, name, email, token: 'e2e-token' };
  }

  /**
   * Answer a request to the GitHub API.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();

    if (pathname === '/graphql') {
      const { query, variables } = request.postDataJSON();
      const data = this.handleGraphQL(query, variables);

      await route.fulfill({ json: data ?? { data: null, errors: [{ message: 'Not mocked' }] } });

      if (!data) {
        this.unhandled.push(`GraphQL ${query.trim().split('\n')[0]}`);
      }

      return;
    }

    const response = this.handleREST(method, pathname, request.postDataJSON());

    if (response) {
      if (response.status === 204) {
        await route.fulfill({ status: 204 });
      } else if (response.json instanceof Buffer) {
        await route.fulfill({ contentType: 'application/octet-stream', body: response.json });
      } else {
        await route.fulfill({ status: response.status ?? 200, json: response.json });
      }

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
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleREST(method, pathname, body) {
    const repoPath = `/repos/${this.owner}/${this.repo}`;

    if (pathname === '/user') {
      const { id, login, name, email } = this.user;

      return {
        json: { id, login, name, email, avatar_url: '', html_url: `https://github.com/${login}` },
      };
    }

    if (pathname === `${repoPath}/collaborators/${this.user.login}`) {
      return { status: 204 };
    }

    if (!pathname.startsWith(`${repoPath}/`)) {
      return undefined;
    }

    const path = pathname.slice(repoPath.length + 1);
    const segments = path.split('/');

    if (method === 'GET' && path.startsWith('git/trees/')) {
      const ref = decodeURIComponent(path.slice('git/trees/'.length));
      const commit = this.refs.has(ref) ? this.getHead(ref) : this.getCommit(ref);

      return commit
        ? {
            json: {
              sha: commit.oid,
              tree: [...commit.tree].map(([filePath, sha]) => ({
                path: filePath,
                mode: '100644',
                type: 'blob',
                sha,
                size: this.blobs.get(sha)?.length,
              })),
              truncated: false,
            },
          }
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

    if (this.getOpenPullRequest(head)) {
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

    return {
      number,
      node_id: nodeId,
      title,
      body,
      state: state === 'merged' ? 'closed' : state,
      merged: state === 'merged',
      draft,
      html_url: `https://github.com/${this.owner}/${this.repo}/pull/${number}`,
      head: { ref: pullRequest.head, sha: this.getPullRequestHead(pullRequest).oid },
      base: { ref: pullRequest.base },
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
    const { number, nodeId, title, draft, labels, createdAt, updatedAt, author } = pullRequest;

    return {
      id: nodeId,
      number,
      title,
      url: `https://github.com/${this.owner}/${this.repo}/pull/${number}`,
      isDraft: draft,
      isCrossRepository: false,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      headRefName: pullRequest.head,
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

    if (query.includes('defaultBranchRef')) {
      return { data: { repository: { defaultBranchRef: { name: this.branch } } } };
    }

    // The repository to create a workflow branch in, and the head of the branch to start it from
    if (/fork:\s*repository\(/.test(query)) {
      return {
        data: {
          fork: { id: this.repositoryId },
          base: { ref: this.getRefNode(variables.branch, { oid: true }) },
        },
      };
    }

    if (query.includes('pullRequests(')) {
      return {
        data: { repository: { pullRequests: { nodes: this.findPullRequests(query, variables) } } },
      };
    }

    const branch = toBranchName(variables.branch ?? this.branch);
    /** @type {Record<string, any>} */
    const repository = {};

    // File contents, fetched in batches with an alias for each file, and the CI checks of a commit,
    // which the CMS shows with the deployment status. There are no checks in this repository. Like
    // GitHub, answer `null` for an object that doesn’t exist
    query
      .matchAll(/(\w+_\d+):\s*object\(oid:\s*"(\w+)"\)\s*\{\s*\.\.\.\s*on\s+(Blob|Commit)\b/g)
      .forEach(([, alias, sha, type]) => {
        if (type === 'Blob') {
          const blob = this.blobs.get(sha);

          repository[alias] = blob ? { text: blob.toString(), isTruncated: false } : null;
        } else {
          repository[alias] = this.getCommit(sha) ? { checkSuites: { nodes: [] } } : null;
        }
      });

    // Files on a branch, as `branch:path` expressions, fetched in batches the same way
    query
      .matchAll(new RegExp(`(\\w+_\\d+):\\s*object\\(expression:\\s*${STRING}\\)`, 'g'))
      .forEach(([, alias, expression]) => {
        const [ref, ...rest] = JSON.parse(expression).split(':');
        const sha = this.refs.has(ref) ? this.getHead(ref).tree.get(rest.join(':')) : undefined;
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
   * @param {string} ref Branch name, qualified or not.
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
          (!headRefName || pullRequest.head === headRefName),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((pullRequest) => this.toPullRequestNode(pullRequest));
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
  createRef({ name, oid }) {
    if (!this.getCommit(oid)) {
      return {
        data: { createRef: null },
        errors: [{ type: 'UNPROCESSABLE', message: 'Object does not exist' }],
      };
    }

    if (!this.createBranch(toBranchName(name), oid)) {
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
    const { branchName } = input.branch;

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

    const pullRequest = this.getOpenPullRequest(branchName);

    if (pullRequest) {
      pullRequest.updatedAt = commit.date;
    }

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
