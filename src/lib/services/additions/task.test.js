import { describe, expect, test, vi } from 'vitest';

import { getRequestErrorMessage, TaskRunner } from '$lib/services/additions/task.svelte';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));

describe('TaskRunner', () => {
  test('tracks a request and the error it ends with', async () => {
    const runner = new TaskRunner();
    /**
     * Finish the request.
     */
    let finish = () => {};

    const promise = runner.run(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    expect(runner.busy).toBe(true);
    finish();
    await promise;
    expect(runner).toMatchObject({ busy: false, error: '' });

    await runner.run(async () => {
      throw new Error('Forbidden', { cause: { message: 'Not allowed' } });
    });
    expect(runner).toMatchObject({ busy: false, error: 'Not allowed' });

    await runner.run(async () => {
      throw new Error('Network');
    });
    expect(runner.error).toBe('additions.error.unexpected');

    // A new request clears the error
    await runner.run(async () => {});
    expect(runner.error).toBe('');
  });

  test('shows a message of its own when the service gives no reason', async () => {
    const runner = new TaskRunner({ fallbackMessageKey: 'send_failed' });

    await runner.run(async () => {
      throw new Error('Network');
    });
    expect(runner.error).toBe('send_failed');
  });

  test('says what a request did once it has succeeded, until the next one or the form is edited', async () => {
    const runner = new TaskRunner();

    await runner.run(async () => {}, { doneMessageKey: 'saved' });
    expect(runner.doneMessageKey).toBe('saved');

    runner.clearDone();
    expect(runner.doneMessageKey).toBe('');

    await runner.run(async () => {}, { doneMessageKey: 'saved' });
    // Not while the next one is on its way, nor after it fails
    await runner.run(
      async () => {
        expect(runner.doneMessageKey).toBe('');
        throw new Error('Network');
      },
      { doneMessageKey: 'saved' },
    );
    expect(runner.doneMessageKey).toBe('');
  });
});

describe('getRequestErrorMessage', () => {
  test('gives the service’s reason, or a fallback', () => {
    expect(getRequestErrorMessage(new Error('x', { cause: { message: 'Wrong.' } }))).toBe('Wrong.');
    expect(getRequestErrorMessage(new Error('Network'))).toBe('additions.error.unexpected');
    expect(getRequestErrorMessage(undefined, 'send_failed')).toBe('send_failed');
  });
});
