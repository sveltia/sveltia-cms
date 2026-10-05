import { createHash } from 'crypto';

/**
 * @import { Page, Request, Route } from '@playwright/test';
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
 * @typedef {object} MockResponse
 * @property {number} [status] HTTP status, 200 by default.
 * @property {any} [json] Response body: JSON, a string for plain text, or a `Buffer` for a file.
 * @property {Record<string, string>} [headers] Response headers.
 */

/**
 * Calculate the Git blob SHA of a file, like `git hash-object` does, so the SHAs match what the CMS
 * calculates for the files it saves.
 * @param {Buffer} content File content.
 * @returns {string} SHA-1 hash.
 */
export const getBlobSHA = (content) =>
  createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');

/**
 * A Git repository kept in memory, with its commits, branches and file contents, which a mocked
 * Git hosting service API answers the CMS from. A test can commit to it as someone else with
 * {@link MockGitRepository.commit} to simulate a colleague’s change.
 */
export class MockGitRepository {
  owner = 'sveltia';

  repo = 'e2e-site';

  /**
   * The default branch, which the CMS is configured with.
   */
  branch = 'main';

  /**
   * The signed-in user.
   * @type {MockUser}
   */
  user = { id: 1, login: 'mona', name: 'Mona Lisa', email: 'mona@example.com' };

  /**
   * Access token of the signed-in user. A request carrying another one is refused.
   */
  token = 'e2e-token';

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
   * Head commit SHA keyed by branch name. A mock can key other branches its own way, e.g. those of
   * a fork on GitHub.
   * @type {Map<string, string>}
   */
  refs = new Map();

  /**
   * The commits the CMS has asked for, whether accepted or not, as it sent them to the API, e.g.
   * the `createCommitOnBranch` inputs on GitHub.
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
   * @param {string} [options.branch] Branch key in {@link refs}, the default branch by default. It
   * has to exist, except for the initial commit.
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
   * @param {string} [branch] Branch key in {@link refs}, the default branch by default.
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
   * Get the commits on a branch that changed a file, the latest first. Merge commits are left out,
   * like the hosting services do in the history of a file.
   * @param {string} path File path.
   * @param {string} [branch] Branch key in {@link refs}, the default branch by default.
   * @returns {MockCommit[]} Commits.
   */
  getFileCommits(path, branch = this.branch) {
    return this.getAncestors(this.getHead(branch).oid).filter(
      ({ paths, parents }) => paths.has(path) && parents.length < 2,
    );
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
   * Merge a branch into another one, file by file, and move the other branch to the merge commit.
   * A file both branches have changed differently since they parted is a conflict, which the
   * hosting services refuse to merge.
   * @param {object} args Arguments.
   * @param {string} args.head Branch to merge.
   * @param {string} args.base Branch to merge into.
   * @param {'merge' | 'squash'} [args.method] Merge method: a merge commit with both heads as
   * parents, or a single commit on the base branch.
   * @param {string} args.message Commit message.
   * @param {MockUser} [args.author] Who merges it, the colleague by default.
   * @returns {MockCommit | undefined} Merge commit, or `undefined` if there is a conflict.
   */
  mergeBranch({ head: headBranch, base, method = 'merge', message, author = this.colleague }) {
    const head = this.getHead(headBranch);
    const baseHead = this.getHead(base);
    const mergeBase = this.getMergeBase(head.oid, baseHead.oid);
    const tree = new Map(baseHead.tree);
    /** @type {string[]} */
    const paths = [];

    const conflict = MockGitRepository.diffTrees(mergeBase.tree, head.tree).some(({ path }) => {
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
      message,
      author,
      parents: method === 'squash' ? [baseHead.oid] : [baseHead.oid, head.oid],
    });

    this.refs.set(base, commit.oid);

    return commit;
  }

  /**
   * Store a session for the user, so the CMS signs in on its own when the page is opened.
   * @param {Page} page Page.
   * @param {string} backendName Name of the backend the session is for, e.g. `github`.
   */
  async storeSession(page, backendName) {
    const { id, login, name, email } = this.user;

    await page.addInitScript(
      (user) => {
        localStorage.setItem('sveltia-cms.user', JSON.stringify(user));
      },
      { backendName, id, login, name, email, token: this.token },
    );
  }

  /**
   * Check whether a request carries the user’s access token, in an `Authorization` header like
   * `token …` or `Bearer …`.
   * @param {Request} request Request.
   * @returns {boolean} Result.
   */
  isAuthorized(request) {
    return request.headers().authorization?.split(' ').at(-1) === this.token;
  }

  /**
   * Answer a request with the response a handler gives, unless it doesn’t carry the user’s access
   * token, which is refused with 401 Unauthorized. A request the handler can’t answer, or
   * throws on, e.g. for a branch that doesn’t exist, is listed in {@link unhandled} and answered
   * with the fallback, so the test fails naming the request instead of leaving it pending until the
   * test times out.
   * @param {Route} route Route.
   * @param {string} label Name of the request for {@link unhandled}, e.g. `GET /user`.
   * @param {() => MockResponse | undefined} handle Function returning the response, or
   * `undefined` if the request isn’t mocked.
   * @param {MockResponse} fallback Response to a request the handler can’t answer.
   */
  async answer(route, label, handle, fallback) {
    /** @type {MockResponse | undefined} */
    let response;

    if (!this.isAuthorized(route.request())) {
      await MockGitRepository.respond(route, { status: 401, json: { message: 'Bad credentials' } });

      return;
    }

    try {
      response = handle();
    } catch (/** @type {any} */ ex) {
      this.unhandled.push(`${label}: ${ex.message}`);
      await MockGitRepository.respond(route, { ...fallback, status: 500 });

      return;
    }

    if (!response) {
      this.unhandled.push(label);
    }

    await MockGitRepository.respond(route, response ?? fallback);
  }

  /**
   * Answer a request with a mocked response: JSON, plain text, or the bytes of a file.
   * @param {Route} route Route.
   * @param {MockResponse} response Response.
   */
  static async respond(route, { status = 200, json, headers }) {
    if (status === 204) {
      await route.fulfill({ status });
    } else if (json instanceof Buffer) {
      await route.fulfill({ status, contentType: 'application/octet-stream', body: json });
    } else if (typeof json === 'string') {
      await route.fulfill({ status, contentType: 'text/plain', body: json });
    } else {
      await route.fulfill({
        status,
        json,
        // Like the hosting services, let the page read the headers across origins
        headers: headers && {
          ...headers,
          'access-control-expose-headers': Object.keys(headers).join(', '),
        },
      });
    }
  }
}
