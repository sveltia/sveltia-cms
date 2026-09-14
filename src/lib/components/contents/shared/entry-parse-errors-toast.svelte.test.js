import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { entryParseErrors } from '$lib/services/contents';
import { waitForToastsToHide } from '$lib/test/toast';

import EntryParseErrorsToast from './entry-parse-errors-toast.svelte';

describe('EntryParseErrorsToast', () => {
  test('reports the entries that could not be parsed', async () => {
    entryParseErrors.current = /** @type {any} */ ([new Error('a'), new Error('b')]);

    try {
      await render(EntryParseErrorsToast, {});
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
          'error There were errors while parsing entry files. Check the browser console for details.',
        );
      await waitForToastsToHide();
    } finally {
      entryParseErrors.current = [];
    }
  });

  test('stays hidden without errors', async () => {
    entryParseErrors.current = [];

    await render(EntryParseErrorsToast, {});
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });
});
