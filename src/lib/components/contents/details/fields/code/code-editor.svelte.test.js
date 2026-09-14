import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CodeEditor from './code-editor.svelte';

/**
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Render the editor within a draft.
 * @param {object} args Arguments.
 * @param {Partial<CodeField>} [args.config] Field options.
 * @param {string | undefined} [args.currentValue] Field value.
 * @param {Record<string, any>} [args.values] Flattened values in the draft.
 * @returns {Promise<{ draft: any, props: any }>} Draft and props.
 */
const renderEditor = async ({ config = {}, currentValue = undefined, values = {} }) => {
  /** @type {CodeField} */
  const fieldConfig = { name: 'snippet', widget: 'code', ...config };
  const draft = createMockDraft({ fields: [fieldConfig], values: { _default: values } });

  const props = $state({
    locale: '_default',
    keyPath: 'snippet',
    typedKeyPath: 'snippet',
    fieldId: 'snippet',
    fieldLabel: 'Snippet',
    fieldConfig,
    currentValue,
  });

  await renderWithDraft(CodeEditor, { draft, props });

  return { draft, props };
};

describe('CodeEditor', () => {
  test('edits the code and language stored under the default keys', async () => {
    const { draft } = await renderEditor({
      values: { snippet: {}, 'snippet.code': 'console.log(1);', 'snippet.lang': 'javascript' },
    });

    const editor = page.getByRole('textbox');

    await expect.element(editor).toHaveTextContent('console.log(1);');
    await expect.element(page.getByRole('combobox')).toHaveTextContent('JavaScript');

    await editor.fill('console.log(2);');
    await expect.poll(() => draft.currentValues._default['snippet.code']).toBe('console.log(2);');
  });

  test('uses the custom keys and the default language', async () => {
    const { draft } = await renderEditor({
      config: { keys: { code: 'source', lang: 'language' }, default_language: 'ruby' },
      values: { snippet: {}, 'snippet.source': 'puts 1' },
    });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('puts 1');
    await expect.element(page.getByRole('combobox')).toHaveTextContent('Ruby');
    await expect.poll(() => draft.currentValues._default['snippet.language']).toBe('ruby');
  });

  test('stores the code only when configured so', async () => {
    const { draft, props } = await renderEditor({
      config: { output_code_only: true, allow_language_selection: false },
      currentValue: 'print(1)',
    });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('print(1)');
    expect(page.getByRole('combobox').elements()).toHaveLength(0);

    await page.getByRole('textbox').fill('print(2)');
    await expect.poll(() => props.currentValue).toBe('print(2)');

    // The draft catching up with the value changes nothing
    draft.currentValues._default.snippet = 'print(2)';
    await expect.element(page.getByRole('textbox')).toHaveTextContent('print(2)');
  });

  test('starts empty without a value, and clears a value of the wrong type', async () => {
    const { draft } = await renderEditor({
      config: { output_code_only: true },
      currentValue: undefined,
    });

    await expect.element(page.getByRole('textbox')).toHaveTextContent('');

    // The stored object is replaced when it holds something other than code and language
    const { draft: other } = await renderEditor({
      values: { snippet: 'not an object', 'snippet.lang': 123 },
    });

    await expect.poll(() => other.currentValues._default.snippet).toEqual({});
    expect(other.currentValues._default['snippet.code']).toBe('');
    // The language selector falls back to plain text
    expect(other.currentValues._default['snippet.lang']).toBe('plain');
    expect(draft.currentValues._default.snippet).toBeUndefined();
  });
});
