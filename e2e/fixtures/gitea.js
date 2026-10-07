import { getBlobSHA, MockGitRepository } from './git.js';

/**
 * @import { Page, Route } from '@playwright/test';
 * @import { MockCommit, MockResponse, MockUser } from './git.js';
 */

/**
 * A pull request on the mocked instance.
 * @typedef {object} MockPullRequest
 * @property {number} number Pull request index, which the API paths use.
 * @property {number} id Internal ID, unique across the instance.
 * @property {string} title Title. A work in progress carries a `WIP: ` prefix.
 * @property {string} headBranch Head branch name.
 * @property {number} headRepoId ID of the repository the head branch is in: the repository’s own,
 * or the fork’s for a pull request from a fork.
 * @property {string} baseBranch Base branch name.
 * @property {string[]} labels Label names.
 * @property {'open' | 'closed'} state State.
 * @property {boolean} merged Whether the pull request has been merged.
 * @property {string} [closedHeadSHA] Head commit SHA as of the moment the pull request was closed
 * or merged, which the instance’s `refs/pull/{number}/head` reference stays at from then on; see
 * {@link MockGitea.getPullRequestRef}.
 * @property {string} [laggingRefSHA] Commit the `refs/pull/{number}/head` reference is held at,
 * which stands in for an instance that hasn’t caught up with a push to the branch yet.
 * @property {string} [mergeBaseSHA] Commit the pull request shared with the configured branch when
 * it was merged, which the instance stores and lists its files from afterwards.
 * @property {MockUser} author Author.
 */

/**
 * ID of the configured repository, which a pull request’s `base.repo_id` carries, and its
 * `head.repo_id` too unless the head branch is in a fork.
 */
const REPO_ID = 1;

/**
 * ID of the signed-in user’s fork, which the head of a pull request from the fork carries.
 */
export const FORK_REPO_ID = 2;

/**
 * Root of the mocked API, the default of the `gitea` backend.
 */
export const GITEA_API_ROOT = 'https://gitea.com/api/v1';

/**
 * A Gitea or Forgejo repository behind a mocked REST API, for the CMS to sign in to, load files
 * from and commit to. A test can commit to it as someone else with {@link MockGitea.commit} to
 * simulate a colleague’s change, and check the bodies of the commit requests the CMS sent in
 * {@link MockGitea.received}.
 */
export class MockGitea extends MockGitRepository {
  /**
   * Root of the API: Gitea.com’s, or a self-hosted instance’s like
   * `https://code.example.com/git/api/v1`. Set it before the page is opened.
   */
  apiRoot = GITEA_API_ROOT;

  /**
   * Whether the instance is Forgejo. By default, it’s told from the {@link version}, but Forgejo
   * can report a bare version like `13.0.3`, which Gitea 28 and later can report as well; the CMS
   * then asks the Forgejo API for its version, which only Forgejo has.
   * @type {boolean | undefined}
   */
  forgejo = undefined;

  /**
   * Version the instance reports. A Forgejo version carries the Gitea version it’s based on, e.g.
   * `13.0.3+gitea-1.22.0`, which makes the CMS read the files with the Forgejo API.
   */
  version = '1.24.0';

  /**
   * Whether the signed-in user can write to the repository. A user who can’t is refused.
   */
  canWrite = true;

  /**
   * Whether the signed-in user can push to the configured branch, which a branch protection rule
   * can forbid.
   */
  canPush = true;

  /**
   * Maximum number of entries in a page of the recursive file tree listing. A larger tree is
   * truncated, and the CMS has to ask for the next page.
   */
  treePageSize = 1000;

  /**
   * Maximum number of items the instance returns in a page of a list, which it applies whatever
   * the request asks for. The CMS reads it from the settings endpoint and pages through.
   */
  maxResponseItems = 50;

  /**
   * Pull requests opened on the repository, in the order they were opened.
   * @type {MockPullRequest[]}
   */
  pullRequests = [];

  /**
   * Labels defined on the repository. Unlike GitHub and GitLab, the instance silently drops a
   * label name that doesn’t exist here rather than creating it.
   * @type {{ id: number, name: string, color: string }[]}
   */
  labels = [];

  /**
   * The signed-in user’s fork of the repository, once {@link createFork} has made it.
   * @type {{ owner: string, repo: string } | undefined}
   */
  fork = undefined;

  /**
   * Whether the fork request fails because the user already has a repository of that name, which
   * makes the CMS ask for the fork under another name.
   */
  forkNameTaken = false;

  /**
   * Whether forking is turned off on the instance, which only Forgejo can do and report.
   */
  forksDisabled = false;

  /**
   * Open a pull request the way the instance does.
   * @param {object} args Arguments.
   * @param {string} args.title Title.
   * @param {string} args.headBranch Head branch name.
   * @param {object} [options] Options.
   * @param {number} [options.headRepoId] ID of the repository holding the head branch.
   * @param {string} [options.baseBranch] Base branch name, the configured one by default.
   * @param {string[]} [options.labels] Label names.
   * @param {MockUser} [options.author] Author.
   * @returns {MockPullRequest} Pull request.
   */
  openPullRequest(
    { title, headBranch },
    { headRepoId = REPO_ID, baseBranch = this.branch, labels = [], author } = {},
  ) {
    labels.forEach((name) => this.createLabel(name));

    /** @type {MockPullRequest} */
    const pullRequest = {
      number: this.pullRequests.length + 1,
      id: 900 + this.pullRequests.length + 1,
      title,
      headBranch,
      headRepoId,
      baseBranch,
      labels: [...labels],
      state: 'open',
      merged: false,
      author: author ?? this.colleague,
    };

    this.pullRequests.push(pullRequest);

    return pullRequest;
  }

  /**
   * Define a label on the repository, unless it’s already there.
   * @param {string} name Label name.
   * @param {string} [color] Label color.
   * @returns {{ id: number, name: string, color: string }} Label.
   */
  createLabel(name, color = '#ededed') {
    const existing = this.labels.find((label) => label.name === name);

    if (existing) {
      return existing;
    }

    const label = { id: this.labels.length + 1, name, color };

    this.labels.push(label);

    return label;
  }

  /**
   * Fork the repository onto the signed-in user’s account, with a copy of the configured branch.
   * Like a fork on the instance, it shares the commits and blobs of the repository, and only its
   * branches are its own.
   * @param {object} [options] Options.
   * @param {string} [options.repo] Name of the fork, the repository’s own by default.
   * @returns {{ owner: string, repo: string }} Fork.
   */
  createFork({ repo = this.repo } = {}) {
    this.fork = { owner: this.user.login, repo };
    this.refs.set(this.forkBranch(this.branch), this.head.oid);

    return this.fork;
  }

  /**
   * Get the key of a branch in the fork, for {@link refs}, {@link commit} and {@link readFile}.
   * @param {string} branch Branch name.
   * @returns {string} Key, e.g. `mona:cms/posts/hello`.
   */
  forkBranch(branch) {
    return `${this.user.login}:${branch}`;
  }

  /**
   * Whether the instance is Forgejo, from {@link forgejo} or its {@link version}.
   * @type {boolean}
   */
  get isForgejo() {
    return this.forgejo ?? this.version.includes('+gitea-');
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
    if (signedIn) {
      await this.storeSession(page, 'gitea');
    }

    const context = page.context();

    await context.route(
      (url) => url.href.startsWith(`${this.apiRoot}/`),
      (route) => this.handleRoute(route),
    );
    // The Forgejo API is next to the Gitea one, e.g. `/api/forgejo/v1` beside `/api/v1`
    await context.route(
      (url) => url.href === new URL('../forgejo/v1/version', `${this.apiRoot}/`).href,
      (route) =>
        this.isForgejo
          ? route.fulfill({ json: { version: this.version } })
          : route.fulfill({ status: 404, json: { message: 'Not Found' } }),
    );
  }

  /**
   * Answer a request to the API.
   * @param {Route} route Route.
   */
  async handleRoute(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.slice(new URL(this.apiRoot).pathname.length);

    await this.answer(
      route,
      `${method} ${path}`,
      () => this.handleREST(method, path, request.postDataJSON(), url.searchParams),
      { status: 404, json: { message: 'Not Found' } },
    );
  }

  /**
   * Answer a request to the REST API.
   * @param {string} method HTTP method.
   * @param {string} pathname URL path after the API root, e.g. `/user`.
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
          login,
          full_name: name,
          email,
          avatar_url: '',
          html_url: `https://gitea.com/${login}`,
        },
      };
    }

    if (pathname === '/version') {
      return { json: { version: this.version } };
    }

    if (pathname === '/settings/repository') {
      return {
        json: {
          mirrors_disabled: false,
          stars_disabled: false,
          // Gitea has no such setting, so it doesn’t report one
          ...(this.isForgejo ? { forks_disabled: this.forksDisabled } : {}),
        },
      };
    }

    if (pathname === '/settings/api') {
      return {
        json: {
          default_paging_num: 30,
          max_response_items: this.maxResponseItems,
          default_max_blob_size: 10485760,
          default_max_response_size: 104857600,
        },
      };
    }

    const repoPath = `/repos/${this.owner}/${this.repo}`;

    if (method === 'GET' && pathname === repoPath) {
      return {
        json: {
          id: REPO_ID,
          full_name: `${this.owner}/${this.repo}`,
          default_branch: this.branch,
          fork: false,
          permissions: { admin: false, push: this.canWrite, pull: true },
        },
      };
    }

    // The CMS looks the user’s fork up by name, then searches their own forks for a renamed one
    if (method === 'GET' && pathname === '/repos/search') {
      return {
        json: {
          data: this.fork ? [{ ...this.toForkItem(), owner: { login: this.user.login } }] : [],
        },
      };
    }

    if (this.fork) {
      const forkPath = `/repos/${this.fork.owner}/${this.fork.repo}`;

      if (method === 'GET' && pathname === forkPath) {
        return { json: this.toForkItem() };
      }

      if (pathname.startsWith(`${forkPath}/`)) {
        return this.handleForkREST(method, pathname.slice(forkPath.length + 1), body, searchParams);
      }
    }

    // Where the CMS looks for the fork first, which isn’t there if it has another name. An
    // unrelated repository of that name is what stops the fork from being created with it
    if (method === 'GET' && pathname.startsWith(`/repos/${this.user.login}/`)) {
      return this.forkNameTaken && pathname === `/repos/${this.user.login}/${this.repo}`
        ? {
            json: {
              full_name: `${this.user.login}/${this.repo}`,
              owner: { login: this.user.login },
              fork: false,
            },
          }
        : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'POST' && pathname === `${repoPath}/forks`) {
      // The instance doesn’t pick another name when the user already has a repository of that
      // name, the way GitHub does; the CMS asks again with a name of its own
      if (this.forkNameTaken && !body?.name) {
        return { status: 409, json: { message: 'repository already exists' } };
      }

      return { status: 202, json: this.toForkItem(this.createFork({ repo: body?.name })) };
    }

    if (!pathname.startsWith(`${repoPath}/`)) {
      return undefined;
    }

    const path = pathname.slice(repoPath.length + 1);
    const [resource, ...rest] = path.split('/');
    const filePath = rest.map((segment) => decodeURIComponent(segment)).join('/');

    if (method === 'GET' && resource === 'branches') {
      if (!this.refs.has(filePath)) {
        return { status: 404, json: { message: 'Branch not found' } };
      }

      const { oid, message } = this.getHead(filePath);

      return {
        json: {
          name: filePath,
          commit: { id: oid, message },
          user_can_push: this.canPush,
          user_can_merge: this.canPush,
        },
      };
    }

    if (method === 'GET' && path.startsWith('git/trees/')) {
      return this.handleTreeRequest(filePath.replace(/^trees\//, ''), searchParams);
    }

    // Gitea reads several files at once with this endpoint, which Forgejo doesn’t have
    if (method === 'POST' && resource === 'file-contents' && !this.isForgejo) {
      const { tree } = this.getHead(searchParams.get('ref') ?? this.branch);

      return {
        json: /** @type {string[]} */ (body?.files ?? []).map((filePath_) => {
          const sha = tree.get(filePath_);

          return sha ? this.toContentsItem(sha, { path: filePath_ }) : null;
        }),
      };
    }

    // Forgejo reads the files by their blob SHAs instead
    if (method === 'GET' && path === 'git/blobs' && this.isForgejo) {
      return {
        json: (searchParams.get('shas') ?? '')
          .split(',')
          .map((sha) => (this.blobs.has(sha) ? this.toContentsItem(sha) : null)),
      };
    }

    if (method === 'GET' && resource === 'raw') {
      const sha = this.getFileSHA(searchParams.get('ref') ?? this.branch, filePath);

      return sha
        ? { json: this.blobs.get(sha)?.toString() }
        : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'media') {
      const sha = this.resolveMediaPath(filePath);

      return sha ? { json: this.blobs.get(sha) } : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'contents') {
      const ref = searchParams.get('ref') ?? this.branch;
      const commit = this.refs.has(ref) ? this.getHead(ref) : this.getCommit(ref);
      const sha = commit?.tree.get(filePath);

      // The endpoint carries the content as well as the blob SHA, which is how Editorial Workflow
      // reads a file on a workflow branch
      if (sha) {
        return { json: this.toContentsItem(sha, { path: filePath }) };
      }

      // A folder is listed instead, which is how the publish check tells the files’ types
      const entries = commit ? this.listFolder(commit.tree, filePath) : [];

      return entries.length ? { json: entries } : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'DELETE' && resource === 'branches') {
      if (!this.refs.has(filePath)) {
        return { status: 404, json: { message: 'Branch not found' } };
      }

      this.refs.delete(filePath);

      return { status: 204, body: '' };
    }

    if (resource === 'labels') {
      if (method === 'GET') {
        return { json: this.paginate(this.labels, searchParams) };
      }

      if (method === 'POST') {
        return { status: 201, json: this.createLabel(body?.name, body?.color) };
      }
    }

    if (resource === 'issues') {
      return this.handleIssueRequest(method, rest, body, searchParams);
    }

    if (resource === 'pulls') {
      return this.handlePullRequest(method, rest, body, searchParams);
    }

    if (method === 'GET' && path.startsWith('git/refs/pull/')) {
      const [, , number] = rest;
      const pullRequest = this.pullRequests.find((pr) => pr.number === Number(number));
      const sha = pullRequest ? this.getPullRequestRef(pullRequest) : '';

      // The path is a prefix filter, which the instance answers with a list even when a single
      // reference matches it exactly
      return sha
        ? { json: [{ ref: `refs/pull/${number}/head`, object: { sha, type: 'commit' } }] }
        : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'compare') {
      return this.handleCompare(filePath);
    }

    if (method === 'POST' && path === 'contents') {
      return this.handleCommit(/** @type {Record<string, any>} */ (body));
    }

    if (method === 'GET' && path === 'commits') {
      const filePath_ = searchParams.get('path') ?? '';
      const branch = searchParams.get('sha') ?? this.branch;

      return {
        json: this.getFileCommits(filePath_, branch)
          .slice(0, Number(searchParams.get('limit') ?? 30))
          .map((commit) => this.toCommitItem(commit)),
      };
    }

    return undefined;
  }

  /**
   * Answer a request to the signed-in user’s fork, where an Open Authoring contributor’s workflow
   * branches live. The fork shares the commits and blobs of the repository, so only the branch
   * names are its own, keyed as `owner:branch` in {@link refs}.
   * @param {string} method HTTP method.
   * @param {string} path URL path after the fork’s own root, e.g. `branches/main`.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} searchParams URL query.
   * @returns {MockResponse | undefined} Response, or `undefined` if the request isn’t mocked.
   */
  handleForkREST(method, path, body, searchParams) {
    const [resource, ...rest] = path.split('/');
    const name = rest.map((segment) => decodeURIComponent(segment)).join('/');

    if (method === 'GET' && resource === 'compare') {
      return this.handleCompare(name, { inFork: true });
    }

    // Forgejo says whether it can sync a branch: only when the fork’s head is one the configured
    // branch descends from, and not the same one
    if (method === 'GET' && resource === 'sync_fork' && this.isForgejo) {
      const key = this.forkBranch(name);

      if (!this.refs.has(key)) {
        return { status: 404, json: { message: 'Branch not found' } };
      }

      const upstream = this.getHead(name).oid;
      const current = this.getHead(key).oid;
      const ancestors = this.getAncestors(upstream);

      return {
        json: {
          allowed: current !== upstream && ancestors.some(({ oid }) => oid === current),
          fork_commit: current,
          base_commit: upstream,
          commits_behind: Math.max(
            ancestors.findIndex(({ oid }) => oid === current),
            0,
          ),
        },
      };
    }

    // The fork’s copy of the configured branch is brought up to date with the repository. The two
    // services have an endpoint of their own for this, and neither has the other’s: Gitea names
    // the branch in the body, Forgejo in the path
    if (method === 'POST' && resource === (this.isForgejo ? 'sync_fork' : 'merge-upstream')) {
      const branch = this.isForgejo ? name : body?.branch;
      const key = this.forkBranch(branch);

      if (!this.refs.has(key)) {
        return { status: 404, json: { message: 'Branch not found' } };
      }

      const upstream = this.getHead(branch).oid;
      const current = this.getHead(key).oid;
      // A fork branch that the upstream one descends from can simply be moved along
      const fastForward = this.getAncestors(upstream).some(({ oid }) => oid === current);

      if (fastForward) {
        this.refs.set(key, upstream);
      }

      // Forgejo only fast-forwards, and turns down a fork carrying commits of its own, as well as
      // one that’s already up to date
      if (this.isForgejo) {
        return fastForward && current !== upstream
          ? { status: 204, body: '' }
          : { status: 400, json: { message: 'You can’t sync this branch' } };
      }

      if (fastForward) {
        return { json: { merge_style: current === upstream ? 'up-to-date' : 'fast-forward' } };
      }

      // Gitea falls back to a merge, and only gives up when the two sides conflict
      const merge = this.mergeBranch({
        head: branch,
        base: key,
        message: `Merge branch '${branch}' of ${this.owner}/${this.repo} into ${branch}`,
        author: this.user,
      });

      return merge
        ? { json: { merge_style: 'merge' } }
        : { status: 409, json: { message: 'merge conflict' } };
    }

    if (resource === 'branches') {
      if (method === 'GET' && !name) {
        const prefix = `${this.user.login}:`;

        const branches = [...this.refs.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({
            name: key.slice(prefix.length),
            commit: this.toBranchCommit(this.getHead(key)),
          }));

        return { json: this.paginate(branches, searchParams) };
      }

      const key = this.forkBranch(name);

      if (!this.refs.has(key)) {
        return { status: 404, json: { message: 'Branch not found' } };
      }

      if (method === 'DELETE') {
        this.refs.delete(key);

        return { status: 204, body: '' };
      }

      if (method === 'GET') {
        return {
          json: {
            name,
            commit: this.toBranchCommit(this.getHead(key)),
            user_can_push: true,
            user_can_merge: true,
          },
        };
      }
    }

    if (method === 'POST' && path === 'contents') {
      return this.handleCommit(/** @type {Record<string, any>} */ (body), { inFork: true });
    }

    if (method === 'GET' && resource === 'contents') {
      const ref = searchParams.get('ref') ?? this.branch;
      const key = this.forkBranch(ref);
      // A ref can be a commit as well as a branch, which the fork shares with the repository
      const commit = this.refs.has(key) ? this.getHead(key) : this.getCommit(ref);
      const sha = commit?.tree.get(name);

      return sha
        ? { json: this.toContentsItem(sha, { path: name }) }
        : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'raw') {
      const ref = this.forkBranch(searchParams.get('ref') ?? this.branch);
      const sha = this.refs.has(ref) ? this.getHead(ref).tree.get(name) : undefined;

      return sha
        ? { json: this.blobs.get(sha)?.toString() }
        : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'media') {
      const sha = this.resolveMediaPath(name, { inFork: true });

      return sha ? { json: this.blobs.get(sha) } : { status: 404, json: { message: 'Not Found' } };
    }

    return undefined;
  }

  /**
   * Make the head commit of a branch listing, which stands in for a pull request while an Open
   * Authoring draft has none.
   * @param {MockCommit} commit Commit.
   * @returns {Record<string, any>} Commit, as the branch endpoints report it.
   */
  toBranchCommit({ oid, message, date, author }) {
    return {
      id: oid,
      message,
      timestamp: date.toISOString(),
      author: { name: author.name, email: author.email, username: author.login },
    };
  }

  /**
   * Make the repository object of the signed-in user’s fork.
   * @param {{ owner: string, repo: string }} [fork] Fork, the current one by default.
   * @returns {Record<string, any>} Repository.
   */
  toForkItem(fork = /** @type {{ owner: string, repo: string }} */ (this.fork)) {
    return {
      id: FORK_REPO_ID,
      full_name: `${fork.owner}/${fork.repo}`,
      owner: { login: fork.owner },
      default_branch: this.branch,
      fork: true,
      parent: { full_name: `${this.owner}/${this.repo}` },
      permissions: { admin: true, push: true, pull: true },
    };
  }

  /**
   * Make the item of a pull request listing, the shape of both the list and the single endpoint.
   * @param {MockPullRequest} pullRequest Pull request.
   * @param {object} [options] Options.
   * @param {boolean} [options.list] Whether the item is part of a list, which Gitea fills in
   * differently.
   * @returns {Record<string, any>} Item.
   */
  toPullRequestItem(pullRequest, { list = false } = {}) {
    const { number, id, title, headBranch, headRepoId, baseBranch, labels, state, merged, author } =
      pullRequest;

    const fromFork = headRepoId !== REPO_ID;
    const branchKey = fromFork ? this.forkBranch(headBranch) : headBranch;
    const liveHeadSHA = this.refs.has(branchKey) ? this.getHead(branchKey).oid : '';
    const refHeadSHA = this.getPullRequestRef(pullRequest);

    return {
      number,
      id,
      title,
      html_url: `https://gitea.com/${this.owner}/${this.repo}/pulls/${number}`,
      state,
      merged,
      // The instance derives the draft state from the title rather than storing it
      draft: /^\s*(?:\[wip\]|wip:)/i.test(title),
      head: {
        // A head branch is labelled with its name alone, never owner-qualified
        label: headBranch,
        ref: headBranch,
        // A Gitea list reads the head SHA off the `refs/pull/{number}/head` reference the instance
        // keeps on the configured repository, which it stops updating once the pull request is
        // closed or merged. Forgejo, and a single pull request on Gitea, report the branch’s
        // current head instead for as long as the branch exists, whatever the state
        sha: (list && !this.isForgejo) || !liveHeadSHA ? refHeadSHA : liveHeadSHA,
        repo_id: headRepoId,
        repo: {
          full_name: fromFork
            ? `${this.user.login}/${this.fork?.repo ?? this.repo}`
            : `${this.owner}/${this.repo}`,
        },
      },
      base: {
        ref: baseBranch,
        repo_id: REPO_ID,
        repo: { full_name: `${this.owner}/${this.repo}` },
      },
      labels: labels.map((name) => this.createLabel(name)),
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      user: { id: author.id, login: author.login, full_name: author.name, email: author.email },
    };
  }

  /**
   * Answer a request to the issue endpoints, which the CMS uses to find its pull requests by label
   * name — the pull request endpoint only filters by label ID — and to label them.
   * @param {string} method HTTP method.
   * @param {string[]} segments Path segments after `issues`.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} searchParams URL query.
   * @returns {MockResponse | undefined} Response.
   */
  handleIssueRequest(method, segments, body, searchParams) {
    if (method === 'GET' && !segments.length) {
      const names = (searchParams.get('labels') ?? '').split(',').filter(Boolean);
      // The instance discards a label name it doesn’t know, and drops the filter altogether once
      // every name has been discarded. An item has to carry every name that’s left
      const known = names.filter((name) => this.labels.some((label) => label.name === name));

      const items = this.pullRequests.filter(
        ({ state, labels }) => state === 'open' && known.every((name) => labels.includes(name)),
      );

      return {
        json: this.paginate(items, searchParams).map((pr) =>
          this.toPullRequestItem(pr, { list: true }),
        ),
      };
    }

    const pullRequest = this.pullRequests.find(({ number }) => number === Number(segments[0]));

    if (!pullRequest || segments[1] !== 'labels') {
      return undefined;
    }

    if (method === 'GET') {
      return { json: pullRequest.labels.map((name) => this.createLabel(name)) };
    }

    if (method === 'POST' || method === 'PUT') {
      // Only a name the repository defines is applied; the rest are silently dropped
      const applied = /** @type {string[]} */ (body?.labels ?? []).filter((name) =>
        this.labels.some((label) => label.name === name),
      );

      pullRequest.labels = method === 'PUT' ? applied : [...pullRequest.labels, ...applied];

      return { json: pullRequest.labels.map((name) => this.createLabel(name)) };
    }

    return undefined;
  }

  /**
   * Answer a request to the pull request endpoints.
   * @param {string} method HTTP method.
   * @param {string[]} segments Path segments after `pulls`.
   * @param {Record<string, any> | null} body Request body.
   * @param {URLSearchParams} searchParams URL query.
   * @returns {MockResponse | undefined} Response.
   */
  handlePullRequest(method, segments, body, searchParams) {
    if (!segments.length) {
      if (method === 'GET') {
        const state = searchParams.get('state') ?? 'open';
        const poster = searchParams.get('poster');
        const labelIds = searchParams.getAll('labels').map(Number);

        const items = this.pullRequests
          .filter(
            (pr) =>
              (state === 'all' || pr.state === state) && (!poster || pr.author.login === poster),
          )
          // The label IDs are matched with a join, so an item carrying any of them is listed, once
          // for each of them it carries
          .flatMap((pr) => {
            if (!labelIds.length) {
              return [pr];
            }

            return pr.labels
              .map((name) => this.labels.find((label) => label.name === name)?.id)
              .filter((id) => id !== undefined && labelIds.includes(id))
              .map(() => pr);
          });

        return {
          json: this.paginate(items, searchParams).map((pr) =>
            this.toPullRequestItem(pr, { list: true }),
          ),
        };
      }

      if (method === 'POST') {
        const { title, head, base } = /** @type {Record<string, string>} */ (body);
        // A cross-repository head is named `owner:branch`
        const [owner, forkRef] = head.includes(':') ? head.split(':') : [undefined, undefined];

        return {
          status: 201,
          json: this.toPullRequestItem(
            this.openPullRequest(
              { title, headBranch: forkRef ?? head },
              {
                headRepoId: owner ? FORK_REPO_ID : REPO_ID,
                author: this.user,
                baseBranch: base,
              },
            ),
          ),
        };
      }
    }

    const pullRequest = this.pullRequests.find(({ number }) => number === Number(segments[0]));

    if (!pullRequest) {
      return undefined;
    }

    if (method === 'GET' && !segments[1]) {
      return { json: this.toPullRequestItem(pullRequest) };
    }

    if (method === 'PATCH' && !segments[1]) {
      if (body?.state && pullRequest.merged) {
        return {
          status: 412,
          json: { message: 'cannot change state of this pull request, it was already merged' },
        };
      }

      if (typeof body?.title === 'string') {
        pullRequest.title = body.title;
      }

      if (body?.state === 'closed' || body?.state === 'open') {
        pullRequest.state = body.state;
        pullRequest.closedHeadSHA =
          body.state === 'closed' ? this.getPullRequestHeadSHA(pullRequest) : undefined;
      }

      return { json: this.toPullRequestItem(pullRequest) };
    }

    if (segments[1] === 'merge') {
      // The CMS asks this to tell a pull request already merged from one that can’t be merged
      if (method === 'GET') {
        return pullRequest.merged
          ? { status: 204, body: '' }
          : { status: 404, json: { message: 'Not Found' } };
      }

      if (method === 'POST') {
        return this.handleMerge(pullRequest, /** @type {Record<string, any>} */ (body));
      }
    }

    if (method === 'GET' && segments[1] === 'files') {
      // The files are worked out from the pull request’s reference rather than its branch, and each
      // one links to its content at that commit
      const headSHA = this.getPullRequestRef(pullRequest);
      const files = headSHA ? this.getChangedFiles(headSHA, pullRequest.mergeBaseSHA) : [];

      return {
        json: this.paginate(files, searchParams).map((file) => ({
          ...file,
          contents_url:
            `${this.apiRoot}/repos/${this.owner}/${this.repo}/contents/` +
            `${encodeURI(file.filename)}?ref=${headSHA}`,
        })),
      };
    }

    return undefined;
  }

  /**
   * Merge a pull request, which the CMS asks for when an entry is published.
   * @param {MockPullRequest} pullRequest Pull request.
   * @param {Record<string, any>} body Request body.
   * @returns {MockResponse} Response.
   */
  handleMerge(pullRequest, body) {
    const { merged, title } = pullRequest;

    // Everything that stops a merge comes back as 405, including the pull request having been
    // merged already
    if (merged) {
      return { status: 405, json: { message: 'PR already merged' } };
    }

    if (/^\s*(?:\[wip\]|wip:)/i.test(title)) {
      return {
        status: 405,
        json: { message: 'Work in progress PRs cannot be merged' },
      };
    }

    // The merge can be pinned to the commit the head branch is expected to point at
    if (body.head_commit_id && body.head_commit_id !== this.getPullRequestHeadSHA(pullRequest)) {
      return { status: 409, json: { message: 'head out of date' } };
    }

    this.mergePullRequest(pullRequest, {
      method: body.Do === 'squash' ? 'squash' : 'merge',
      message: body.MergeTitleField,
      author: this.user,
    });

    return { status: 200, body: '' };
  }

  /**
   * Merge a pull request into the configured branch, which a test does to stand in for a
   * maintainer who merged it on the instance.
   * @param {MockPullRequest} pullRequest Pull request.
   * @param {object} [options] Options.
   * @param {'merge' | 'squash'} [options.method] Merge method.
   * @param {string} [options.message] Commit message.
   * @param {MockUser} [options.author] Author of the merge commit.
   * @returns {MockPullRequest} The same pull request, now merged.
   */
  mergePullRequest(pullRequest, { method = 'merge', message, author } = {}) {
    const { headBranch, headRepoId, title } = pullRequest;
    const headSHA = this.getPullRequestHeadSHA(pullRequest);

    pullRequest.mergeBaseSHA = this.getMergeBase(this.getHead(this.branch).oid, headSHA).oid;

    this.mergeBranch({
      head: headRepoId === REPO_ID ? headBranch : this.forkBranch(headBranch),
      base: this.branch,
      method,
      message: message ?? title,
      author: author ?? this.colleague,
    });

    pullRequest.merged = true;
    pullRequest.state = 'closed';
    pullRequest.closedHeadSHA = headSHA;

    return pullRequest;
  }

  /**
   * Get the current head commit SHA of a pull request.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {string} Commit SHA, or an empty string if the head branch is gone.
   */
  getPullRequestHeadSHA({ headBranch, headRepoId }) {
    const branchKey = headRepoId === REPO_ID ? headBranch : this.forkBranch(headBranch);

    return this.refs.has(branchKey) ? this.getHead(branchKey).oid : '';
  }

  /**
   * Get the commit the instance’s `refs/pull/{number}/head` reference points at: the head branch’s
   * while the pull request is open, and the one it had when it was closed or merged from then on.
   * @param {MockPullRequest} pullRequest Pull request.
   * @returns {string} Commit SHA, or an empty string if there’s none to go by.
   */
  getPullRequestRef(pullRequest) {
    return (
      pullRequest.closedHeadSHA ??
      pullRequest.laggingRefSHA ??
      this.getPullRequestHeadSHA(pullRequest)
    );
  }

  /**
   * List the entries of a folder, the way the contents endpoint does for a path that isn’t a file.
   * @param {Map<string, string>} tree File tree.
   * @param {string} dir Folder path, or an empty string for the root.
   * @returns {Record<string, any>[]} Entries.
   */
  listFolder(tree, dir) {
    const prefix = dir ? `${dir}/` : '';
    /** @type {Map<string, Record<string, any>>} */
    const entries = new Map();

    tree.forEach((sha, path) => {
      if (!path.startsWith(prefix)) {
        return;
      }

      const [name, ...rest] = path.slice(prefix.length).split('/');
      const entryPath = `${prefix}${name}`;

      entries.set(
        entryPath,
        rest.length
          ? { name, path: entryPath, type: 'dir' }
          : { name, path: entryPath, type: 'file', sha },
      );
    });

    return [...entries.values()];
  }

  /**
   * Answer a comparison of two branches, which the CMS uses to find the files an Open Authoring
   * draft changes when it has no pull request to list them from.
   * @param {string} basehead Comparison, e.g. `main...cms/mona/e2e-site/posts/hello`, or one across
   * repositories like `main...mona:cms/mona/e2e-site/posts/hello`.
   * @param {object} [options] Options.
   * @param {boolean} [options.inFork] Whether the comparison is asked of the fork, whose branches
   * both sides name.
   * @returns {MockResponse} Response.
   */
  handleCompare(basehead, { inFork = false } = {}) {
    const [baseName, headName] = basehead.split('...');

    /**
     * Resolve one side of the comparison, which can name a branch or a commit.
     * @param {string} name Branch name or commit SHA. A cross-repository head is named
     * `owner:branch`, which is how a fork branch is keyed.
     * @returns {string | undefined} Commit SHA, or `undefined` if there’s no such branch or commit.
     */
    const resolve = (name) => {
      const key = inFork ? this.forkBranch(name) : name;

      return this.refs.has(key) ? this.getHead(key).oid : this.getCommit(name)?.oid;
    };

    const baseSHA = resolve(baseName);
    const headSHA = resolve(headName);

    if (!baseSHA || !headSHA) {
      return { status: 404, json: { message: 'Not Found' } };
    }

    const baseOIDs = new Set(this.getAncestors(baseSHA).map(({ oid }) => oid));
    const commits = this.getAncestors(headSHA).filter(({ oid }) => !baseOIDs.has(oid));

    // Gitea reads the files of each commit from the repository the comparison is asked of, which
    // doesn’t have a commit only the fork holds, unless a pull request has brought it over
    const pulledOIDs = new Set(
      this.pullRequests
        .map((pr) => this.getPullRequestRef(pr))
        .filter(Boolean)
        .flatMap((sha) => this.getAncestors(sha).map(({ oid }) => oid)),
    );

    if (
      !inFork &&
      !this.isForgejo &&
      headName.includes(':') &&
      commits.some(({ oid }) => !pulledOIDs.has(oid))
    ) {
      return { status: 500, json: { message: '' } };
    }

    return {
      json: {
        total_commits: commits.length,
        // The comparison reports the files each commit touched rather than the net change
        commits: commits.map((commit) => ({
          sha: commit.oid,
          files: [...commit.paths].map((path) => ({ filename: path })),
        })),
      },
    };
  }

  /**
   * Get the files a commit changes since the commit it shares with the configured branch, in the
   * shape of the pull request file listing.
   * @param {string} headSHA Commit SHA.
   * @param {string} [baseSHA] Commit to compare with, the merge base by default.
   * @returns {Record<string, any>[]} Changed files.
   */
  getChangedFiles(headSHA, baseSHA) {
    const { tree } = /** @type {MockCommit} */ (this.getCommit(headSHA));

    const { tree: baseTree } = baseSHA
      ? /** @type {MockCommit} */ (this.getCommit(baseSHA))
      : this.getMergeBase(this.getHead(this.branch).oid, headSHA);

    /** @type {Record<string, any>[]} */
    const files = [];

    tree.forEach((sha, path) => {
      if (baseTree.get(path) !== sha) {
        files.push({ filename: path, status: baseTree.has(path) ? 'changed' : 'added' });
      }
    });

    baseTree.forEach((_sha, path) => {
      if (!tree.has(path)) {
        files.push({ filename: path, status: 'deleted' });
      }
    });

    return files;
  }

  /**
   * Take the page of a list the request asks for, capped at what the instance is willing to return
   * however large a `limit` the request carries.
   * @template T
   * @param {T[]} items Items.
   * @param {URLSearchParams} searchParams URL query, with the page number and size.
   * @returns {T[]} Page.
   */
  paginate(items, searchParams) {
    const limit = Math.min(Number(searchParams.get('limit') ?? 30), this.maxResponseItems);
    const page = Number(searchParams.get('page') ?? 1);

    return items.slice((page - 1) * limit, page * limit);
  }

  /**
   * Resolve the path of a `media` request, where the branch and the file path are run together
   * with nothing to tell them apart. A workflow branch has slashes of its own, so the instance
   * takes the longest leading part of the path that names a branch.
   * @param {string} path Branch name followed by the file path, e.g.
   * `cms/posts/hello/static/images/sunrise.png`.
   * @param {object} [options] Options.
   * @param {boolean} [options.inFork] Whether the branch is in the signed-in user’s fork.
   * @returns {string | undefined} Blob SHA, or `undefined` if there’s no such branch or file.
   */
  resolveMediaPath(path, { inFork = false } = {}) {
    const segments = path.split('/');

    for (let count = segments.length - 1; count > 0; count -= 1) {
      const branch = segments.slice(0, count).join('/');
      const key = inFork ? this.forkBranch(branch) : branch;

      if (this.refs.has(key)) {
        return this.getHead(key).tree.get(segments.slice(count).join('/'));
      }
    }

    return undefined;
  }

  /**
   * Get the blob SHA of a file on a branch.
   * @param {string} branch Branch name.
   * @param {string} path File path.
   * @returns {string | undefined} SHA, or `undefined` if the branch or the file doesn’t exist.
   */
  getFileSHA(branch, path) {
    return this.refs.has(branch) ? this.getHead(branch).tree.get(path) : undefined;
  }

  /**
   * Answer a request for the recursive file tree of a commit, a page at a time.
   * @param {string} ref Commit SHA or branch name.
   * @param {URLSearchParams} searchParams URL query, with the page number.
   * @returns {MockResponse} Response.
   */
  handleTreeRequest(ref, searchParams) {
    const commit = this.refs.has(ref) ? this.getHead(ref) : this.getCommit(ref);

    if (!commit) {
      return { status: 404, json: { message: 'Not Found' } };
    }

    const page = Number(searchParams.get('page') ?? 1);
    const entries = [...commit.tree].sort(([a], [b]) => a.localeCompare(b));
    const start = (page - 1) * this.treePageSize;

    return {
      json: {
        sha: commit.oid,
        tree: entries.slice(start, start + this.treePageSize).map(([path, sha]) => ({
          path,
          mode: '100644',
          type: 'blob',
          sha,
          size: this.blobs.get(sha)?.length ?? 0,
        })),
        truncated: start + this.treePageSize < entries.length,
        page,
        total_count: entries.length,
      },
    };
  }

  /**
   * Make an item of a file contents listing, with the file encoded in Base64.
   * @param {string} sha Blob SHA.
   * @param {object} [options] Options.
   * @param {string} [options.path] File path, which Gitea includes and Forgejo doesn’t.
   * @returns {Record<string, any>} Item.
   */
  toContentsItem(sha, { path } = {}) {
    const blob = /** @type {Buffer} */ (this.blobs.get(sha));

    return {
      ...(path ? { path, name: path.split('/').pop(), type: 'file' } : {}),
      sha,
      size: blob.length,
      encoding: 'base64',
      content: blob.toString('base64'),
    };
  }

  /**
   * Make an item of a commit listing.
   * @param {MockCommit} commit Commit.
   * @returns {Record<string, any>} Item.
   */
  toCommitItem({ oid, message, date, author }) {
    return {
      sha: oid,
      created: date.toISOString(),
      commit: {
        message,
        author: { name: author.name, email: author.email, date: date.toISOString() },
      },
      author: author.login ? { id: author.id, login: author.login, avatar_url: '' } : null,
    };
  }

  /**
   * Handle a request to change several files in one commit. Like Gitea, refuse a change to a file
   * whose blob SHA isn’t the one the request carries, because someone else has changed the file
   * since, with 422 Unprocessable Entity, or 409 Conflict on Forgejo, and refuse to create a file
   * that already exists, with 422 on both. `new_branch` creates the branch the commit lands on
   * from `branch`, which the instance refuses once that branch exists.
   * @param {Record<string, any>} body Request body.
   * @param {object} [options] Options.
   * @param {boolean} [options.inFork] Whether the commit lands in the signed-in user’s fork, where
   * the branches are keyed as `owner:branch` in {@link refs}.
   * @returns {MockResponse} Response.
   */
  handleCommit(body, { inFork = false } = {}) {
    /**
     * Get the key of a branch for {@link refs}.
     * @param {string} name Branch name.
     * @returns {string} Key.
     */
    const key = (name) => (inFork ? this.forkBranch(name) : name);

    this.received.push(body);

    const { beforeCommit } = this;

    this.beforeCommit = undefined;
    beforeCommit?.();

    const { branch: startBranch, new_branch: newBranch, message, files } = body;
    // Without `new_branch` the commit lands on `branch` itself
    const branch = newBranch ?? startBranch;

    if (!this.canPush) {
      return { status: 403, json: { message: 'User does not have permission to push' } };
    }

    if (newBranch) {
      if (this.refs.has(key(newBranch))) {
        return {
          status: 422,
          json: { message: `branch already exists [name: ${newBranch}]` },
        };
      }

      this.createBranch(key(newBranch), this.getHead(key(startBranch)).oid);
    }

    const { tree: currentTree } = this.getHead(key(branch));
    const tree = new Map(currentTree);
    /** @type {string[]} */
    const paths = [];

    /** @type {MockResponse | undefined} */
    const refusal = /** @type {Record<string, any>[]} */ (files)
      .map(({ operation, path, content, from_path: fromPath, sha }) => {
        const knownPath = fromPath ?? path;

        if (operation === 'create') {
          if (tree.has(path)) {
            return {
              status: 422,
              json: { message: `repository file already exists [path: ${path}]` },
            };
          }
        } else if (tree.get(knownPath) !== sha) {
          return this.isForgejo
            ? { status: 409, json: { message: `sha does not match [given: ${sha}]` } }
            : { status: 422, json: { message: `sha does not match [given: ${sha}]` } };
        }

        if (operation === 'delete') {
          tree.delete(path);
          paths.push(path);

          return undefined;
        }

        if (fromPath && fromPath !== path) {
          tree.delete(fromPath);
          paths.push(fromPath);
        }

        const buffer = Buffer.from(content, 'base64');
        const blobSHA = getBlobSHA(buffer);

        this.blobs.set(blobSHA, buffer);
        tree.set(path, blobSHA);
        paths.push(path);

        return undefined;
      })
      .find((response) => !!response);

    if (refusal) {
      return refusal;
    }

    const commit = this.addCommit({
      tree,
      paths,
      message,
      author: /** @type {MockUser} */ (this.user),
      parents: [this.getHead(key(branch)).oid],
    });

    this.refs.set(key(branch), commit.oid);

    return {
      status: 201,
      json: {
        commit: { sha: commit.oid, created: commit.date.toISOString() },
        files: /** @type {Record<string, any>[]} */ (files).map(({ operation, path }) =>
          operation === 'delete' ? null : { path, sha: tree.get(path) },
        ),
      },
    };
  }
}
