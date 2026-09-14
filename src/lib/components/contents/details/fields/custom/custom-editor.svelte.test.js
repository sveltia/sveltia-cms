import { createElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CustomEditor from './custom-editor.svelte';

/**
 * @import { CustomField } from '$lib/types/public';
 */

/** @type {CustomField} */
const fieldConfig = /** @type {any} */ ({ name: 'stars', widget: 'rating', max: 5 });

/**
 * A custom control: a number input reporting changes through the Netlify/Decap CMS API.
 * @param {any} props Control props.
 * @returns {any} React element.
 */
const RatingControl = ({ forID, value, field, onChange, classNameWrapper }) =>
  createElement('input', {
    id: forID,
    className: classNameWrapper,
    type: 'number',
    max: field.get('max'),
    value: value ?? '',
    /**
     * Report the new value.
     * @param {any} event Event.
     * @returns {void} Nothing.
     */
    onChange: (event) => onChange(Number(event.target.value)),
  });

/**
 * Render the editor within a draft.
 * @param {any} currentValue Field value.
 * @param {any} [control] Control component.
 * @returns {Promise<{ draft: any, props: any, entryDraft: any, unmount: () => void }>} Draft,
 * props, draft state and unmount function.
 */
const renderEditor = async (currentValue, control = RatingControl) => {
  const draft = createMockDraft({
    fields: [fieldConfig],
    values: { _default: { stars: currentValue } },
  });

  const props = $state({
    locale: '_default',
    keyPath: 'stars',
    typedKeyPath: 'stars',
    fieldId: 'stars',
    fieldLabel: 'Stars',
    fieldConfig,
    currentValue,
    control,
  });

  const { entryDraft, unmount } = await renderWithDraft(CustomEditor, { draft, props });

  return { draft, props, entryDraft, unmount };
};

/** @type {any[]} */
const reports = [];

/**
 * A control that exposes the file helpers through buttons, and reports the outcome.
 * @param {any} props Control props.
 * @returns {any} React element.
 */
const FileControl = ({ addFile, pickFile, onChange }) =>
  createElement(
    'div',
    null,
    createElement(
      'button',
      {
        type: 'button',
        /**
         * Add a file to the draft.
         * @returns {Promise<void>}
         */
        onClick: async () => {
          try {
            const url = await addFile(new File(['x'], 'note.txt', { type: 'text/plain' }));

            reports.push(url);
            onChange(url);
          } catch (/** @type {any} */ error) {
            reports.push(error);
            onChange(error.message);
          }
        },
      },
      'Add',
    ),
    createElement(
      'button',
      {
        type: 'button',
        /**
         * Pick a file.
         * @returns {Promise<void>}
         */
        onClick: async () => {
          try {
            reports.push(await pickFile());
          } catch (/** @type {any} */ error) {
            reports.push(error);
          }
        },
      },
      'Pick',
    ),
  );

describe('CustomEditor', () => {
  test('renders the React control with the Netlify/Decap CMS-compatible props', async () => {
    await renderEditor(3);

    const input = page.getByRole('spinbutton');

    await expect.element(input).toHaveValue(3);
    await expect.element(input).toHaveAttribute('id', 'stars');
    await expect.element(input).toHaveAttribute('max', '5');
  });

  test('writes a change reported by the control to the draft', async () => {
    const { draft } = await renderEditor(3);

    await page.getByRole('spinbutton').fill('4');

    await expect.poll(() => draft.currentValues._default.stars).toBe(4);
  });

  test('re-renders the control when the value changes externally', async () => {
    const { props } = await renderEditor(3);

    await expect.element(page.getByRole('spinbutton')).toHaveValue(3);
    props.currentValue = 5;
    await expect.element(page.getByRole('spinbutton')).toHaveValue(5);
  });

  test('stores a non-primitive value under its key paths', async () => {
    /**
     * A control storing an object.
     * @param {any} props Control props.
     * @returns {any} React element.
     */
    const PointControl = ({ onChange }) => {
      /**
       * Report an object value.
       * @returns {void} Nothing.
       */
      const onClick = () => onChange({ x: 1, y: 2 });

      return createElement('button', { type: 'button', onClick }, 'Set');
    };

    const { draft } = await renderEditor(undefined, PointControl);

    await page.getByRole('button', { name: 'Set' }).click();

    await expect.poll(() => draft.currentValues._default['stars.x']).toBe(1);
    expect(draft.currentValues._default['stars.y']).toBe(2);
  });

  test('lets the control add a file to the draft', async () => {
    reports.length = 0;

    const { draft } = await renderEditor(undefined, FileControl);

    await page.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => draft.currentValues._default.stars).toMatch(/^blob:/);
    expect(Object.values(draft.files)[0]).toEqual(
      expect.objectContaining({ file: expect.any(File) }),
    );
  });

  test('lets the control pick a file, unless the entry editor has been left', async () => {
    reports.length = 0;

    const { entryDraft } = await renderEditor(undefined, FileControl);

    await page.getByRole('button', { name: 'Pick' }).click();

    const dialog = page.getByRole('dialog', { name: 'Select File' });

    await expect.element(dialog).toBeInTheDocument();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => reports).toEqual([null]);

    // The helpers can’t be used once the draft is gone, but a control may still hold them
    entryDraft.current = null;
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Pick' }).click();
    await expect.poll(() => reports.length).toBe(3);
    expect(reports[1].message).toBe('addFile() can only be called while an entry is being edited');
    expect(reports[2].message).toBe('pickFile() can only be called while an entry is being edited');
  });

  test('registers the control instance for validation', async () => {
    const isValid = vi.fn(() => true);

    /**
     * A class control with an `isValid` method, as Netlify/Decap CMS expects.
     */
    class ValidatingControl {
      /**
       * Create the control.
       * @param {any} props Control props.
       */
      constructor(props) {
        this.props = props;
      }

      /**
       * Validate the value.
       * @returns {boolean} Result.
       */
      isValid = isValid;

      /**
       * Render the control.
       * @returns {any} React element.
       */
      render() {
        return createElement('input', { value: this.props.value ?? '', readOnly: true });
      }
    }

    // React treats a class as a component when it has a `render()` method
    /** @type {any} */ (ValidatingControl.prototype).isReactComponent = {};

    const { unmount } = await renderEditor(3, ValidatingControl);

    await vi.waitFor(() => expect(isValid).toHaveBeenCalled());

    // The instance is unregistered along with the control
    unmount();
    await expect.poll(() => document.querySelector('input')).toBeNull();
  });
});
