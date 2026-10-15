import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Create the environment for the `git` command, isolated from the user’s and system configuration.
 * Auto maintenance is turned off: `git commit` would otherwise start a detached `git maintenance`
 * that deletes its lock file in `.git` while a test removes the folder, and on Linux `rmSync()`
 * then returns without an error, leaving the rest of the folder, `.git/config` included, behind.
 * @param {object} [identity] Author and committer of the commits Git makes.
 * @param {string} [identity.name] Name.
 * @param {string} [identity.email] Email address.
 * @returns {Record<string, string | undefined>} Environment variables.
 */
export const createGitEnv = ({ name = 'Jane Doe', email = 'jane@example.com' } = {}) => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1', // cspell:disable-line
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'maintenance.auto',
  GIT_CONFIG_VALUE_0: 'false',
  GIT_AUTHOR_NAME: name,
  GIT_AUTHOR_EMAIL: email,
  GIT_COMMITTER_NAME: name,
  GIT_COMMITTER_EMAIL: email,
});

/**
 * Default environment for the `git` command.
 */
export const GIT_ENV = createGitEnv();

/**
 * Create a temporary folder for a test repository.
 * @param {string} prefix Prefix of the folder name.
 * @returns {string} Path of the folder.
 */
export const createTempDir = (prefix) => mkdtempSync(join(tmpdir(), prefix));

/**
 * Run a Git command in a test repository.
 * @param {string} repoDir Path of the repository.
 * @param {string[]} args Arguments.
 * @param {Record<string, string | undefined>} [env] Environment variables.
 * @returns {Buffer} Output.
 */
export const runGitRaw = (repoDir, args, env = GIT_ENV) =>
  execFileSync('git', args, { cwd: repoDir, env, stdio: 'pipe' });

/**
 * Run a Git command in a test repository.
 * @param {string} repoDir Path of the repository.
 * @param {...string} args Arguments.
 * @returns {string} Output, trimmed.
 */
export const runGit = (repoDir, ...args) => runGitRaw(repoDir, args).toString().trim();

/**
 * Write a file in a test repository, creating the folders it needs.
 * @param {string} repoDir Path of the repository.
 * @param {string} path Path relative to the repository root.
 * @param {string} content Content.
 */
export const writeRepoFile = (repoDir, path, content) => {
  mkdirSync(dirname(join(repoDir, path)), { recursive: true });
  writeFileSync(join(repoDir, path), content);
};
