import { describe, expect, test } from 'vitest';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CodePreview from './code-preview.svelte';

/**
 * @import { CodeField } from '$lib/types/public';
 */

/**
 * Render the preview within an entry draft holding the given values.
 * @param {object} args Arguments.
 * @param {Partial<CodeField>} [args.config] Field options.
 * @param {string | Record<string, string> | undefined} [args.currentValue] Field value.
 * @param {Record<string, any>} [args.values] Flattened entry values in the current locale.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async ({ config = {}, currentValue = undefined, values = {} }) => {
  const { container } = await renderWithDraft(CodePreview, {
    draft: createMockDraft({ values: { _default: values } }),
    props: {
      locale: '_default',
      keyPath: 'snippet',
      typedKeyPath: 'snippet',
      fieldId: 'snippet',
      fieldLabel: 'Snippet',
      fieldConfig: { name: 'snippet', widget: 'code', ...config },
      currentValue,
    },
  });

  return container;
};

describe('CodePreview', () => {
  test('shows the code and language stored under the default keys', async () => {
    const container = await renderPreview({
      values: { 'snippet.code': 'console.log(1);', 'snippet.lang': 'js' },
    });

    const pre = container.querySelector('pre');

    expect(pre?.textContent).toBe('console.log(1);');
    expect(pre).toHaveClass('language-js');
  });

  test('reads the code and language from custom keys', async () => {
    const container = await renderPreview({
      config: { keys: { code: 'source', lang: 'language' } },
      values: { 'snippet.source': 'puts 1', 'snippet.language': 'ruby' },
    });

    const pre = container.querySelector('pre');

    expect(pre?.textContent).toBe('puts 1');
    expect(pre).toHaveClass('language-ruby');
  });

  test('shows the value itself with the default language when only the code is stored', async () => {
    const container = await renderPreview({
      config: { output_code_only: true, default_language: 'python' },
      currentValue: 'print(1)',
    });

    const pre = container.querySelector('pre');

    expect(pre?.textContent).toBe('print(1)');
    expect(pre).toHaveClass('language-python');
  });

  test('marks no language when none is known', async () => {
    const container = await renderPreview({
      config: { output_code_only: true },
      currentValue: 'print(1)',
    });

    expect(container.querySelector('pre')).not.toHaveAttribute('class');
  });

  test('shows nothing when there is no code', async () => {
    expect((await renderPreview({})).children).toHaveLength(0);
    expect(
      (await renderPreview({ config: { output_code_only: true }, currentValue: '' })).children,
    ).toHaveLength(0);
  });
});
