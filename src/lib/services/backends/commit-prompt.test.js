// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsConfig: { current: undefined },
  backend: { current: undefined },
  prefs: { localGitCommits: false },
}));

vi.mock('$lib/services/config', () => ({ cmsConfig: mocks.cmsConfig }));
vi.mock('$lib/services/backends', () => ({ backend: mocks.backend }));
vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: mocks.prefs }));

vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createBaseCommitMessage: vi.fn((changes) => `Update “${changes[0].path}”`),
}));

vi.mock('$lib/services/backends/root-dir', () => ({
  toRepoChanges: vi.fn((changes) => changes.map((c) => ({ ...c, path: `site/${c.path}` }))),
}));

/** @type {import('./commit-prompt')} */
let service;
const changes = [{ action: 'update', slug: 'a', path: 'a.md' }];
const options = { commitType: 'update' };

/**
 * Set the configured mode and a Git backend.
 * @param {any} mode `prompt_commit_messages` value.
 */
const configure = (mode) => {
  mocks.cmsConfig.current = { backend: { name: 'github', prompt_commit_messages: mode } };
  mocks.backend.current = { isGit: true, name: 'github' };
};

/**
 * Start a prompt and wait for the request to show up.
 * @param {object} [opts] Commit options.
 * @returns {{ promise: Promise<any>, request: any }} Pending result and the request.
 */
const start = (opts = options) => {
  const promise = service.promptCommitMessage(changes, opts);

  return { promise, request: service.commitMessageRequest.current };
};

describe('backends/commit-prompt', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.cmsConfig.current = undefined;
    mocks.backend.current = undefined;
    mocks.prefs.localGitCommits = false;
    service = await import('./commit-prompt');
  });

  describe('isCommitCancelled()', () => {
    it('should tell a cancellation from other errors', () => {
      expect(service.isCommitCancelled(new Error('commit_cancelled'))).toBe(true);
      expect(service.isCommitCancelled(new Error('saving_failed'))).toBe(false);
      expect(service.isCommitCancelled(undefined)).toBe(false);
    });
  });

  describe('getCommitMessagePromptMode()', () => {
    it('should return undefined without a config or a backend', () => {
      expect(service.getCommitMessagePromptMode()).toBeUndefined();

      mocks.cmsConfig.current = { backend: { name: 'github', prompt_commit_messages: true } };

      expect(service.getCommitMessagePromptMode()).toBeUndefined();
    });

    it('should return the configured mode for a Git backend', () => {
      configure(true);
      expect(service.getCommitMessagePromptMode()).toBe(true);
      configure('prefix');
      expect(service.getCommitMessagePromptMode()).toBe('prefix');
      configure('suffix');
      expect(service.getCommitMessagePromptMode()).toBe('suffix');
    });

    it('should return undefined when the option is off or invalid', () => {
      configure(false);
      expect(service.getCommitMessagePromptMode()).toBeUndefined();
      configure(undefined);
      expect(service.getCommitMessagePromptMode()).toBeUndefined();
      configure('both');
      expect(service.getCommitMessagePromptMode()).toBeUndefined();
    });

    it('should only ask with the local backend when local Git commits are on', () => {
      configure(true);
      mocks.backend.current = { isGit: false, name: 'local' };

      expect(service.getCommitMessagePromptMode()).toBeUndefined();

      mocks.prefs.localGitCommits = true;

      expect(service.getCommitMessagePromptMode()).toBe(true);

      // The test backend never commits, whatever the preference left over from the local backend
      mocks.backend.current = { isGit: false, name: 'test-repo' };

      expect(service.getCommitMessagePromptMode()).toBeUndefined();
    });
  });

  describe('promptCommitMessage()', () => {
    it('should return the options as they are when prompting is not configured', async () => {
      configure(false);

      await expect(service.promptCommitMessage(changes, options)).resolves.toBe(options);
      expect(service.commitMessageRequest.current).toBeUndefined();
    });

    it('should not ask again when the options already have a message', async () => {
      configure(true);

      const opts = { ...options, userMessage: '' };

      await expect(service.promptCommitMessage(changes, opts)).resolves.toBe(opts);
      expect(service.commitMessageRequest.current).toBeUndefined();
    });

    it('should ask for the whole message in the `true` mode', async () => {
      configure(true);

      const { promise, request } = start();

      // The paths are named relative to the repository root, as in the commit message
      expect(request).toMatchObject({
        mode: true,
        defaultMessage: 'Update “site/a.md”',
        initialValue: 'Update “site/a.md”',
      });

      request.respond('  Fix the typo  ');

      await expect(promise).resolves.toEqual({ ...options, userMessage: 'Fix the typo' });
      expect(service.commitMessageRequest.current).toBeUndefined();
    });

    it('should leave an unchanged message to be made from the template again', async () => {
      configure(true);

      const { promise, request } = start();

      request.respond('Update “site/a.md”');

      await expect(promise).resolves.toEqual({ ...options, userMessage: '' });
    });

    it('should remember the text added in the `prefix` or `suffix` mode', async () => {
      configure('prefix');

      const first = start();

      expect(first.request).toMatchObject({ mode: 'prefix', initialValue: '' });
      first.request.respond(' JIRA-1 ');
      await expect(first.promise).resolves.toEqual({ ...options, userMessage: 'JIRA-1' });

      configure('suffix');

      const second = start();

      expect(second.request).toMatchObject({ mode: 'suffix', initialValue: 'JIRA-1' });
      second.request.respond('');
      await expect(second.promise).resolves.toEqual({ ...options, userMessage: '' });

      // The `true` mode doesn’t touch the remembered text
      configure(true);

      const third = start();

      third.request.respond('Message');
      await third.promise;
      configure('prefix');

      expect(start().request.initialValue).toBe('');
    });

    it('should throw when the user cancels', async () => {
      configure('prefix');

      const { promise, request } = start();

      request.respond(null);

      await expect(promise).rejects.toThrow('commit_cancelled');
      expect(service.commitMessageRequest.current).toBeUndefined();
    });

    it('should cancel an earlier request left unanswered', async () => {
      configure(true);

      const first = start();
      const second = start();

      await expect(first.promise).rejects.toThrow('commit_cancelled');
      expect(service.commitMessageRequest.current).toBe(second.request);

      // Answering the stale request again doesn’t take down the newer one
      first.request.respond('Stale');
      expect(service.commitMessageRequest.current).toBe(second.request);

      second.request.respond('New');
      await expect(second.promise).resolves.toEqual({ ...options, userMessage: 'New' });
    });
  });
});
