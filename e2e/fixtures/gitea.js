import { getBlobSHA, MockGitRepository } from './git.js';

/**
 * @import { Page, Route } from '@playwright/test';
 * @import { MockCommit, MockResponse, MockUser } from './git.js';
 */

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

    if (pathname === '/settings/api') {
      return {
        json: {
          default_paging_num: 30,
          max_response_items: 50,
          default_max_blob_size: 10485760,
          default_max_response_size: 104857600,
        },
      };
    }

    const repoPath = `/repos/${this.owner}/${this.repo}`;

    if (method === 'GET' && pathname === repoPath) {
      return {
        json: {
          full_name: `${this.owner}/${this.repo}`,
          default_branch: this.branch,
          permissions: { admin: false, push: this.canWrite, pull: true },
        },
      };
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
      // The branch comes first, then the file path
      const [branch, ...segments] = filePath.split('/');
      const sha = this.getFileSHA(branch, segments.join('/'));

      return sha ? { json: this.blobs.get(sha) } : { status: 404, json: { message: 'Not Found' } };
    }

    if (method === 'GET' && resource === 'contents') {
      const ref = searchParams.get('ref') ?? this.branch;
      const commit = this.refs.has(ref) ? this.getHead(ref) : this.getCommit(ref);
      const sha = commit?.tree.get(filePath);

      return sha
        ? { json: { path: filePath, sha, type: 'file' } }
        : { status: 404, json: { message: 'Not Found' } };
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
   * that already exists, with 422 on both.
   * @param {Record<string, any>} body Request body.
   * @returns {MockResponse} Response.
   */
  handleCommit(body) {
    this.received.push(body);

    const { beforeCommit } = this;

    this.beforeCommit = undefined;
    beforeCommit?.();

    const { branch, message, files } = body;

    if (!this.canPush) {
      return { status: 403, json: { message: 'User does not have permission to push' } };
    }

    const { tree: currentTree } = this.getHead(branch);
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
      parents: [this.getHead(branch).oid],
    });

    this.refs.set(branch, commit.oid);

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
