import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { customComponentRegistry } from '$lib/services/api/registries';
import { EntryDraftState, setEntryDraftRoot } from '$lib/services/contents/draft/state.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft } from '$lib/test/draft';

import EditorComponent from './editor-component.svelte';

const fields = [
  { name: 'title', label: 'Title', widget: 'string', required: true },
  { name: 'url', label: 'URL', widget: 'string', required: false },
];

/** @type {HTMLElement[]} */
const wrappers = [];

/**
 * Render the component the way the rich text editor does: within an entry editor pane, whose
 * elements tell the component which draft, locale and field it belongs to.
 * @param {Record<string, any>} props Props.
 * @param {object} [options] Options.
 * @param {boolean} [options.contained] Whether the pane elements are there. Otherwise the
 * component can’t tell which locale and field it belongs to.
 * @returns {Promise<{ draft: any, onChange: any, wrapper: HTMLElement, component: any }>} Draft,
 * handler, wrapper and component.
 */
const renderComponent = async (props, { contained = true } = {}) => {
  const draft = createMockDraft({
    fields: [{ name: 'body', widget: 'markdown' }],
    values: { _default: { body: '' } },
  });

  const entryDraft = new EntryDraftState();

  entryDraft.current = draft;

  const wrapper = document.createElement('div');

  if (contained) {
    wrapper.dataset.locale = '_default';
    wrapper.dataset.keyPath = 'body';
    wrapper.dataset.typedKeyPath = 'body';
  }

  document.body.appendChild(wrapper);
  wrappers.push(wrapper);
  setEntryDraftRoot(wrapper, entryDraft);

  const onChange = vi.fn();

  const { component } = await render(EditorComponent, {
    target: wrapper,
    props: /** @type {any} */ ({
      componentName: 'card',
      label: 'Card',
      fields,
      summary: '{{title}}',
      onChange,
      ...props,
    }),
  });

  return { draft, onChange, wrapper, component };
};

/**
 * Get the values of the component held in the draft.
 * @param {any} draft Draft.
 * @returns {Record<string, any>} Values without the prefix.
 */
const getStoredValues = (draft) =>
  Object.fromEntries(
    Object.entries(draft.extraValues._default).map(([key, value]) => [
      key.replace(/^body:[^:]+:/, ''),
      value,
    ]),
  );

describe('EditorComponent', () => {
  beforeAll(async () => {
    // The fields are looked up in the component definition
    customComponentRegistry.set('card', /** @type {any} */ ({ id: 'card', label: 'Card', fields }));

    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'body', widget: 'markdown' }],
        },
      ],
    });
  });

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.remove());
    wrappers.length = 0;
  });

  afterAll(() => {
    customComponentRegistry.delete('card');
  });

  describe('block mode', () => {
    test('edits the fields in place, reporting the changes', async () => {
      const { draft, onChange } = await renderComponent({
        values: { title: 'Hello', url: 'https://example.com' },
      });

      const group = page.getByRole('group', { name: 'Card' });

      await expect.element(group).toHaveAttribute('data-component-name', 'card');
      await expect
        .element(group.getByRole('button', { name: 'Collapse' }))
        .toHaveAttribute('aria-expanded', 'true');

      const title = group.getByRole('textbox', { name: 'Title' });

      await expect.element(title).toHaveValue('Hello');
      // The values live in the draft under a prefixed key path
      await expect
        .poll(() => getStoredValues(draft))
        .toEqual({
          title: 'Hello',
          url: 'https://example.com',
          __sc_component_name: 'card',
        });
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'update',
            detail: expect.objectContaining({ title: 'Hello' }),
          }),
        ),
      );

      await title.fill('Hi');
      await vi.waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith(
          expect.objectContaining({
            type: 'update',
            detail: expect.objectContaining({ title: 'Hi' }),
          }),
        ),
      );
    });

    test('handles the keys pressed within the block', async () => {
      const { onChange, wrapper } = await renderComponent({ values: { title: 'Hello' } });
      const block = /** @type {HTMLElement} */ (wrapper.querySelector('.component'));

      await expect.element(page.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
      expect(block).toHaveClass('block');

      const { wrapper: inlineWrapper } = await renderComponent({
        inline: true,
        values: { title: 'Hello' },
      });

      expect(inlineWrapper.querySelector('.component')).toHaveClass('inline');

      // Typing in a field, and moving the focus with Tab, is left to the browser
      const input = /** @type {HTMLElement} */ (block.querySelector('input'));
      const typing = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });

      input.dispatchEvent(typing);
      expect(typing.defaultPrevented).toBe(false);

      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

      block.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);

      // Any other key on the block itself is swallowed, so the editor doesn’t act on it
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

      block.dispatchEvent(enter);
      expect(enter.defaultPrevented).toBe(true);
      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'remove' }));
    });

    test('collapses, and can be removed', async () => {
      const { onChange, wrapper } = await renderComponent({ values: { title: 'Hello' } });
      const group = page.getByRole('group', { name: 'Card' });

      await expect.element(group.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
      await group.getByRole('button', { name: 'Collapse' }).click();
      await expect.poll(() => group.getByRole('textbox').elements().length).toBe(0);

      await group.getByRole('button', { name: 'Remove' }).click();
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'remove' }));

      // The Backspace key on the block removes it too
      wrapper
        .querySelector('.component')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      expect(
        onChange.mock.calls.filter((/** @type {any[]} */ [event]) => event.type === 'remove'),
      ).toHaveLength(2);
    });

    test('shows the first text field or the label without a summary template', async () => {
      // A field without a widget is a string field
      const { wrapper } = await renderComponent({
        mode: 'dialog',
        summary: undefined,
        fields: [
          { name: 'count', widget: 'number' },
          { name: 'note', widget: 'text' },
          { name: 'name' },
        ],
        values: { count: 1, note: 'Note', name: 'Name' },
      });

      await expect
        .poll(() => wrapper.querySelector('.placeholder')?.textContent?.trim())
        .toBe('Note');
    });

    test('starts collapsed with the default values when requested', async () => {
      // The change handler is optional
      const { draft, component, wrapper } = await renderComponent({
        collapsed: true,
        values: undefined,
        onChange: undefined,
      });

      await expect
        .element(page.getByRole('group', { name: 'Card' }).getByRole('button', { name: 'Expand' }))
        .toBeInTheDocument();
      await expect
        .poll(() => getStoredValues(draft))
        .toEqual({
          title: '',
          url: '',
          __sc_component_name: 'card',
        });
      expect(component.getElement()).toBe(wrapper.querySelector('.component'));
    });

    test('reconciles the values with the field definitions', async () => {
      // A list where a single value is expected: the first item is kept
      const { draft } = await renderComponent({ values: { title: ['Hello', 'World'], url: 1 } });

      await expect
        .poll(() => getStoredValues(draft))
        .toEqual({ title: 'Hello', url: '1', __sc_component_name: 'card' });
    });
  });

  describe('dialog mode', () => {
    test('shows a summary, and edits the fields in a dialog', async () => {
      const { onChange } = await renderComponent({
        mode: 'dialog',
        inline: true,
        values: { title: 'Hello', url: '' },
      });

      const placeholder = page.getByRole('button', { name: 'Card' });

      await expect.element(placeholder).toHaveTextContent('Hello');
      await expect.element(placeholder).toHaveClass('inline');
      // Nothing is reported until the dialog is confirmed
      expect(onChange).not.toHaveBeenCalled();

      await placeholder.click();

      const dialog = page.getByRole('dialog', { name: 'Card' });

      await dialog.getByRole('textbox', { name: 'Title' }).fill('Hi');
      await dialog.getByRole('button', { name: 'Update' }).click();

      await vi.waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'update',
            detail: { title: 'Hi', url: '', __sc_component_name: 'card' },
          }),
        ),
      );
      await expect.element(placeholder).toHaveTextContent('Hi');
    });

    test('shows the first text field or the label without a summary template', async () => {
      await renderComponent({
        mode: 'dialog',
        summary: undefined,
        values: { title: ' Hello ', url: '' },
      });

      await expect.element(page.getByRole('button', { name: 'Card' })).toHaveTextContent('Hello');

      await renderComponent({
        mode: 'dialog',
        summary: undefined,
        values: { title: ' ', url: '' },
      });

      await expect
        .poll(() =>
          page
            .getByRole('button', { name: 'Card' })
            .elements()
            .map((el) => el.textContent?.trim()),
        )
        .toEqual(['Hello', 'Card']);
    });

    test('restores the values when dismissed with the Escape key', async () => {
      const { draft, onChange } = await renderComponent({
        mode: 'dialog',
        values: { title: 'Hello', url: '' },
      });

      await page.getByRole('button', { name: 'Card' }).click();

      const dialog = page.getByRole('dialog', { name: 'Card' });

      await dialog.getByRole('textbox', { name: 'Title' }).fill('Hi');
      await expect.poll(() => getStoredValues(draft).title).toBe('Hi');
      await userEvent.keyboard('{Escape}');

      await expect.poll(() => getStoredValues(draft).title).toBe('Hello');
      await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    test('restores the values when cancelled', async () => {
      const { draft, onChange } = await renderComponent({
        mode: 'dialog',
        values: { title: 'Hello', url: '' },
      });

      await page.getByRole('button', { name: 'Card' }).click();

      const dialog = page.getByRole('dialog', { name: 'Card' });

      await dialog.getByRole('textbox', { name: 'Title' }).fill('Hi');
      await expect.poll(() => getStoredValues(draft).title).toBe('Hi');
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect.poll(() => getStoredValues(draft).title).toBe('Hello');
      expect(onChange).not.toHaveBeenCalled();
    });

    test('opens right away for a new component, which is removed when cancelled', async () => {
      const { onChange } = await renderComponent({ mode: 'dialog', values: undefined });
      const dialog = page.getByRole('dialog', { name: 'Card' });

      await expect.element(dialog).toBeInTheDocument();
      await expect.element(dialog.getByRole('button', { name: 'Insert' })).toBeInTheDocument();

      // An invalid entry can’t be inserted
      await dialog.getByRole('button', { name: 'Insert' }).click();
      await expect
        .element(dialog.getByRole('alert'))
        .toHaveTextContent('error This field is required.');
      expect(onChange).not.toHaveBeenCalled();

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'remove' }));
    });

    test('has no fields to edit outside an entry editor pane', async () => {
      await renderComponent({ mode: 'dialog', values: undefined }, { contained: false });

      const dialog = page.getByRole('dialog', { name: 'Card' });

      await expect.element(dialog).toBeInTheDocument();
      expect(dialog.getByRole('textbox').elements()).toHaveLength(0);
    });

    test('can be removed from the dialog or with the keyboard', async () => {
      const { onChange } = await renderComponent({ mode: 'dialog', values: { title: 'Hello' } });
      const placeholder = page.getByRole('button', { name: 'Card' });

      placeholder.element().focus();
      await userEvent.keyboard('{Enter}');

      const dialog = page.getByRole('dialog', { name: 'Card' });

      await expect.element(dialog).toBeInTheDocument();
      await dialog.getByRole('button', { name: 'Remove' }).click();
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'remove' }));

      placeholder
        .element()
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      expect(
        onChange.mock.calls.filter((/** @type {any[]} */ [event]) => event.type === 'remove'),
      ).toHaveLength(2);
    });
  });
});
