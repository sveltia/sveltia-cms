import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import UuidEditor from './uuid-editor.svelte';

/**
 * @import { UuidField } from '$lib/types/public';
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Render the editor within an entry draft whose default locale is `en`.
 * @param {object} [options] Options.
 * @param {string | undefined} [options.currentValue] Field value.
 * @param {string} [options.locale] Locale of the pane.
 * @param {Partial<UuidField>} [options.config] Field options.
 * @returns {Promise<{ props: { currentValue: string | undefined } }>} Props, whose `currentValue`
 * follows the editor.
 */
const renderEditor = async ({ currentValue = undefined, locale = 'en', config = {} } = {}) => {
  const props = $state({
    locale,
    keyPath: 'id',
    typedKeyPath: 'id',
    fieldId: 'id',
    fieldLabel: 'ID',
    fieldConfig: /** @type {UuidField} */ ({ name: 'id', widget: 'uuid', ...config }),
    currentValue,
  });

  await renderWithDraft(UuidEditor, {
    draft: createMockDraft({ i18n: { defaultLocale: 'en', allLocales: ['en', 'ja'] } }),
    props,
  });

  return { props };
};

describe('UuidEditor', () => {
  test('generates a UUID for a new entry', async () => {
    const { props } = await renderEditor();

    expect(props.currentValue).toMatch(UUID_REGEX);
    await expect.element(page.getByRole('textbox')).toHaveValue(props.currentValue);
  });

  test('generates a prefixed random ID when encoding is enabled', async () => {
    const { props } = await renderEditor({ config: { prefix: 'post-', use_b32_encoding: true } });

    expect(props.currentValue).toMatch(/^post-[0-9a-z]+$/);
  });

  test('keeps an existing value', async () => {
    const { props } = await renderEditor({ currentValue: 'existing' });

    expect(props.currentValue).toBe('existing');
    await expect.element(page.getByRole('textbox')).toHaveValue('existing');
  });

  test('leaves another locale empty unless the field is translated', async () => {
    expect((await renderEditor({ locale: 'ja' })).props.currentValue).toBe(undefined);
    expect(
      (await renderEditor({ locale: 'ja', config: { i18n: 'duplicate' } })).props.currentValue,
    ).toBe(undefined);
    expect(
      (await renderEditor({ locale: 'ja', config: { i18n: true } })).props.currentValue,
    ).toMatch(UUID_REGEX);
    expect(
      (await renderEditor({ locale: 'ja', config: { i18n: 'translate' } })).props.currentValue,
    ).toMatch(UUID_REGEX);
  });

  test('is read-only unless configured otherwise', async () => {
    await renderEditor();
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
  });

  test('can be edited when the deprecated `read_only` option is off', async () => {
    const { props } = await renderEditor({ config: { read_only: false } });
    const input = page.getByRole('textbox');

    await expect.element(input).not.toHaveAttribute('aria-readonly', 'true');
    await input.fill('custom-id');
    expect(props.currentValue).toBe('custom-id');
  });
});
