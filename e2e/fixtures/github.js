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
 */

/**
 * @typedef {object} MockUser
 * @property {number} id User ID.
 * @property {string} login User name.
 * @property {string} name Display name.
 * @property {string} email Email address.
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
 * A GitHub repository behind a mocked REST and GraphQL API, for the CMS to sign in to, load files
 * from and commit to. A test can commit to it as someone else with {@link MockGitHub.commit} to
 * simulate a colleague’s change, and check what the CMS committed in {@link MockGitHub.received}.
 */
export class MockGitHub {
  owner = 'sveltia';

  repo = 'e2e-site';

  branch = 'main';

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
   * Commits on the branch, the oldest first.
   * @type {MockCommit[]}
   */
  commits = [];

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
   * Create a repository with an empty initial commit.
   */
  constructor() {
    this.commit({}, { message: 'Initial commit' });
  }

  /**
   * The latest commit on the branch.
   * @type {MockCommit}
   */
  get head() {
    return /** @type {MockCommit} */ (this.commits.at(-1));
  }

  /**
   * Commit files to the branch.
   * @param {Record<string, string | Buffer | null>} files File content keyed by path; `null`
   * deletes the file.
   * @param {object} [options] Options.
   * @param {string} [options.message] Commit message.
   * @param {MockUser} [options.author] Author, the colleague by default.
   * @returns {MockCommit} New commit.
   */
  commit(files, { message = 'Update files', author = this.colleague } = {}) {
    const tree = new Map(this.commits.at(-1)?.tree);

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

    /** @type {MockCommit} */
    const commit = {
      oid: createHash('sha1').update(`commit ${this.commits.length} ${message}`).digest('hex'),
      message,
      // At least a second apart, so their order is clear from the dates
      date: new Date(Math.max(Date.now(), (this.commits.at(-1)?.date.getTime() ?? 0) + 1000)),
      author,
      tree,
      paths: new Set(Object.keys(files)),
    };

    this.commits.push(commit);

    return commit;
  }

  /**
   * Get the content of a file on the branch.
   * @param {string} path File path.
   * @returns {string | undefined} File content, or `undefined` if the file doesn’t exist.
   */
  readFile(path) {
    const sha = this.head.tree.get(path);

    return sha ? this.blobs.get(sha)?.toString() : undefined;
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
    const repoPath = `/repos/${this.owner}/${this.repo}`;

    if (pathname === '/graphql') {
      const { query, variables } = request.postDataJSON();
      const data = this.handleGraphQL(query, variables);

      await route.fulfill({ json: data ?? { data: null, errors: [{ message: 'Not mocked' }] } });

      if (!data) {
        this.unhandled.push(`GraphQL ${query.trim().split('\n')[0]}`);
      }

      return;
    }

    if (pathname === '/user') {
      const { id, login, name, email } = this.user;

      await route.fulfill({
        json: { id, login, name, email, avatar_url: '', html_url: `https://github.com/${login}` },
      });

      return;
    }

    if (pathname === `${repoPath}/collaborators/${this.user.login}`) {
      await route.fulfill({ status: 204 });

      return;
    }

    if (pathname.startsWith(`${repoPath}/git/trees/`)) {
      const ref = decodeURIComponent(pathname.slice(`${repoPath}/git/trees/`.length));
      const commit = ref === this.branch ? this.head : this.commits.find(({ oid }) => oid === ref);

      if (commit) {
        await route.fulfill({
          json: {
            sha: commit.oid,
            tree: [...commit.tree].map(([path, sha]) => ({
              path,
              mode: '100644',
              type: 'blob',
              sha,
              size: this.blobs.get(sha)?.length,
            })),
            truncated: false,
          },
        });

        return;
      }
    }

    if (pathname.startsWith(`${repoPath}/git/blobs/`)) {
      const blob = this.blobs.get(pathname.slice(`${repoPath}/git/blobs/`.length));

      if (blob) {
        await route.fulfill({ contentType: 'application/octet-stream', body: blob });

        return;
      }
    }

    this.unhandled.push(`${request.method()} ${pathname}`);
    await route.fulfill({ status: 404, json: { message: 'Not Found' } });
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

    if (query.includes('defaultBranchRef')) {
      return { data: { repository: { defaultBranchRef: { name: this.branch } } } };
    }

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
          repository[alias] = this.commits.some(({ oid }) => oid === sha)
            ? { checkSuites: { nodes: [] } }
            : null;
        }
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
        repository[alias] = {
          target: { history: { nodes: this.getHistory(JSON.parse(path), Number(first)) } },
        };
      });

    if (Object.keys(repository).length) {
      return { data: { repository } };
    }

    // The head of the branch
    if (/on Commit\s*\{\s*oid\s*\}/.test(query)) {
      return { data: { repository: { ref: { target: { oid: this.head.oid } } } } };
    }

    // The latest commit on the branch
    if (/history\(first:\s*1\)/.test(query)) {
      const { oid, message } = this.head;

      return {
        data: { repository: { ref: { target: { history: { nodes: [{ oid, message }] } } } } },
      };
    }

    return undefined;
  }

  /**
   * Get the commits that changed a file, the latest first, as the `history` of a GraphQL `Commit`.
   * @param {string} path File path.
   * @param {number} first Maximum number of commits.
   * @returns {Record<string, any>[]} Commit nodes.
   */
  getHistory(path, first) {
    return this.commits
      .filter(({ paths }) => paths.has(path))
      .reverse()
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
   * Handle the `createCommitOnBranch` mutation. Like GitHub, refuse the commit if the branch has
   * moved since the CMS loaded it.
   * @param {string} query Mutation, which asks for the SHA of each added file with an alias.
   * @param {Record<string, any>} input Mutation input.
   * @returns {Record<string, any>} Response body.
   */
  createCommitOnBranch(query, input) {
    this.received.push(input);

    const { beforeCommit } = this;

    this.beforeCommit = undefined;
    beforeCommit?.();

    if (input.expectedHeadOid !== this.head.oid) {
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
      { message: input.message.headline, author: this.user },
    );

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
