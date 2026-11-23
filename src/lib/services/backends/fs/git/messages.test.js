import { describe, expect, test, vi } from 'vitest';

import {
  getLocalGitReasonLabel,
  getLocalGitStatusLabel,
} from '$lib/services/backends/fs/git/messages';

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ values: true }),
);

describe('getLocalGitReasonLabel()', () => {
  test('returns the explanation of a reason', () => {
    expect(getLocalGitReasonLabel({ reason: 'staged_changes' })).toBe(
      'local_git_skip_reasons.staged_changes:{"path":"","message":""}',
    );
  });

  test('fills in the details', () => {
    expect(getLocalGitReasonLabel({ reason: 'lfs', detail: 'static/a.png' })).toBe(
      'local_git_skip_reasons.lfs:{"path":"static/a.png","message":"static/a.png"}',
    );
  });
});

describe('getLocalGitReasonLabel() for an operation in progress', () => {
  test('returns the explanation of the operation', () => {
    expect(getLocalGitReasonLabel({ reason: 'operation_in_progress', detail: 'rebase' })).toBe(
      'local_git_skip_reasons.operation_in_progress.rebase',
    );
  });
});

describe('getLocalGitStatusLabel()', () => {
  test('returns the branch and author when the changes can be committed', () => {
    expect(
      getLocalGitStatusLabel({
        ready: true,
        branch: 'refs/heads/feature/refs/heads',
        author: { name: 'Jane Doe', email: 'jane@example.com' },
      }),
    ).toBe(
      'prefs.developer.local_git.ready:{"branch":"feature/refs/heads","name":"Jane Doe","email":"jane@example.com"}',
    );
  });

  test('returns the reason when they can’t', () => {
    expect(getLocalGitStatusLabel({ ready: false, reason: 'detached_head' })).toBe(
      'prefs.developer.local_git.not_ready:{"reason":"local_git_skip_reasons.detached_head:{\\"path\\":\\"\\",\\"message\\":\\"\\"}"}',
    );
  });
});
