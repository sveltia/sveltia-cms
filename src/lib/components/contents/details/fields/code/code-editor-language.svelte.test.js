import { setCodeHighlighterLoaders } from '@sveltia/ui';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import {
  awaitPendingFieldUpdates,
  fieldUpdatePending,
} from '$lib/services/contents/editor/pending';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CodeEditor from './code-editor.svelte';

/**
 * @import { CodeField } from '$lib/types/public';
 */

test('registers a language change as pending until it reaches the draft', async () => {
  /** @type {PromiseWithResolvers<any>} */
  const { promise, reject } = Promise.withResolvers();

  // The editor handles the rejection below by way of awaiting the engine. Handle it here too, so
  // that a run where it never asks for one reports the failed assertion rather than burying it
  // under an unhandled rejection
  promise.catch(() => {});

  // Hold the syntax highlighter, which the editor loads before it gives the code block the new
  // language, so that the change can be observed on its way. The loaders are module state shared
  // by everything in a test file, so this is the only test here
  setCodeHighlighterLoaders({
    /**
     * Wait for the engine until the test gives up on it.
     * @returns {Promise<any>} Promise that never resolves.
     */
    loadEngine: () => promise,
  });

  /** @type {CodeField} */
  const fieldConfig = { name: 'snippet', widget: 'code', default_language: 'plain' };

  const draft = createMockDraft({
    fields: [fieldConfig],
    // A plain code block needs no highlighter, so the engine is only loaded once Ruby is picked
    values: { _default: { snippet: {}, 'snippet.code': 'puts 1', 'snippet.lang': 'plain' } },
  });

  await renderWithDraft(CodeEditor, {
    draft,
    props: {
      locale: '_default',
      keyPath: 'snippet',
      typedKeyPath: 'snippet',
      fieldId: 'snippet',
      fieldLabel: 'Snippet',
      fieldConfig,
    },
  });

  const combobox = page.getByRole('combobox', { name: 'Language' });

  await expect.element(page.getByRole('textbox')).toHaveTextContent('puts 1');
  await expect.element(combobox).toHaveTextContent('Plain Text');
  await expect.poll(() => fieldUpdatePending.current).toBe(false);

  try {
    await combobox.click();
    await page.getByRole('searchbox', { name: 'Filter Options' }).fill('Ruby');
    await page.getByRole('option', { name: 'Ruby', exact: true }).click();

    // The change hasn’t reached the draft, so a save made now would write the previous language.
    // Picking a language is a change the user made, so it has to hold the save up like typing does
    expect(fieldUpdatePending.current).toBe(true);
    expect(draft.currentValues._default['snippet.lang']).toBe('plain');
  } finally {
    // Give up on the engine, which leaves the code unhighlighted but still changes its language.
    // This runs even if an assertion above failed, so the engine is never left loading
    reject(new Error('Not available in tests'));
  }

  await awaitPendingFieldUpdates();
  expect(draft.currentValues._default['snippet.lang']).toBe('ruby');
  expect(draft.currentValues._default['snippet.code']).toBe('puts 1');
  expect(fieldUpdatePending.current).toBe(false);
});
