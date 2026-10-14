import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { editors } from '$lib/components/contents/details/fields';

import BulkEditCell from './bulk-edit-cell.svelte';

describe('BulkEditCell', () => {
  test('renders the field control named after the field and the entry', async () => {
    const onChange = vi.fn();

    const { container } = await render(BulkEditCell, {
      locale: '_default',
      fieldConfig: { name: 'title', label: 'Title', widget: 'string' },
      entryLabel: 'Hello',
      value: 'Hello',
      onChange,
    });

    const textbox = page.getByRole('textbox', { name: '\u2068Title\u2069 of \u2068Hello\u2069' });

    await expect.element(textbox).toHaveValue('Hello');
    await expect.element(textbox).not.toHaveAttribute('aria-invalid', 'true');

    const cell = /** @type {HTMLElement} */ (container.querySelector('.cell'));

    expect(cell.dataset.fieldType).toBe('string');
    expect(cell.classList.contains('edited')).toBe(false);
    expect(cell.classList.contains('invalid')).toBe(false);
    expect(page.getByRole('alert').elements()).toHaveLength(0);

    await textbox.fill('Hi');
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith('Hi'));
  });

  test('falls back to the field name and the String type', async () => {
    const { container } = await render(BulkEditCell, {
      locale: '_default',
      fieldConfig: { name: 'subtitle' },
      entryLabel: 'Hello',
      value: undefined,
      onChange: vi.fn(),
    });

    await expect
      .element(page.getByRole('textbox', { name: '\u2068subtitle\u2069 of \u2068Hello\u2069' }))
      .toHaveValue('');
    expect(/** @type {HTMLElement} */ (container.querySelector('.cell')).dataset.fieldType).toBe(
      'string',
    );
  });

  test('marks an edited value and shows the validation messages', async () => {
    const { container } = await render(BulkEditCell, {
      locale: '_default',
      fieldConfig: { name: 'title', label: 'Title', widget: 'string' },
      entryLabel: 'Hello',
      value: '',
      edited: true,
      errors: ['This field is required.', 'Too short.'],
      onChange: vi.fn(),
    });

    const cell = /** @type {HTMLElement} */ (container.querySelector('.cell'));

    expect(cell.classList.contains('edited')).toBe(true);
    expect(cell.classList.contains('invalid')).toBe(true);
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('This field is required.Too short.');
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows a Select field as a dropdown list however few options it has', async () => {
    const onChange = vi.fn();

    await render(BulkEditCell, {
      locale: '_default',
      fieldConfig: {
        name: 'category',
        label: 'Category',
        widget: 'select',
        options: ['News', 'Events'],
      },
      entryLabel: 'Hello',
      value: 'News',
      onChange,
    });

    const combobox = page.getByRole('combobox', {
      name: '\u2068Category\u2069 of \u2068Hello\u2069',
    });

    await expect.element(combobox).toBeVisible();
    expect(page.getByRole('radio').elements()).toHaveLength(0);

    await combobox.click();
    await page.getByRole('option', { name: 'Events' }).click();
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith('Events'));
  });

  test('renders the control of a Boolean field', async () => {
    const onChange = vi.fn();

    await render(BulkEditCell, {
      locale: '_default',
      fieldConfig: { name: 'draft', label: 'Draft', widget: 'boolean' },
      entryLabel: 'Hello',
      value: false,
      onChange,
    });

    const toggle = page.getByRole('switch', { name: '\u2068Draft\u2069 of \u2068Hello\u2069' });

    await toggle.click();
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(true));
  });

  test('gives the editor the field’s identity, as the entry editor does', async () => {
    /** @type {Record<string, any>} */
    let editorProps = {};

    // None of the controls a cell can hold reads all of these, so look at what the editor is given
    // with a stand-in that reads them
    editors.stub = /** @type {any} */ (
      /**
       * Stand-in editor component.
       * @param {Comment} _anchor Anchor.
       * @param {Record<string, any>} props Props.
       */
      (_anchor, props) => {
        editorProps = {
          locale: props.locale,
          keyPath: props.keyPath,
          typedKeyPath: props.typedKeyPath,
          fieldLabel: props.fieldLabel,
          required: props.required,
          invalid: props.invalid,
        };
      }
    );

    try {
      await render(BulkEditCell, {
        locale: 'en',
        fieldConfig: { name: 'title', label: 'Title', widget: 'stub', required: false },
        entryLabel: 'Hello',
        value: 'Hello',
        onChange: vi.fn(),
      });

      expect(editorProps).toEqual({
        locale: 'en',
        keyPath: 'title',
        typedKeyPath: 'title',
        fieldLabel: 'Title',
        required: false,
        invalid: false,
      });
    } finally {
      delete editors.stub;
    }
  });
});
