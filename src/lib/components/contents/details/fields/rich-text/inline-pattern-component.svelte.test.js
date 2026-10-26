/* eslint-disable jsdoc/require-jsdoc */
import { createElement } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import InlinePatternComponent from './inline-pattern-component.svelte';

/** @type {HTMLElement[]} */
const wrappers = [];
/**
 * Convert wikilink data to Markdown.
 * @param {Record<string, any>} data Data.
 * @returns {string} Markdown.
 */
const toInline = ({ page: name = '' }) => `[[${name}]]`;
/**
 * Convert wikilink data to a preview.
 * @param {Record<string, any>} data Data.
 * @returns {string} Preview.
 */
const toPreview = ({ page: name = '' }) => `<a href="/${name}">${name}</a>`;

/**
 * Render the component within a rich text editor textbox, the way the editor does.
 * @param {Record<string, any>} props Props.
 * @param {object} [options] Options.
 * @param {boolean} [options.readonly] Whether the textbox is read-only.
 * @returns {Promise<{ onChange: any, textbox: HTMLElement, component: any }>} Handler, textbox
 * and component.
 */
const renderComponent = async (props, { readonly = false } = {}) => {
  const textbox = document.createElement('div');

  textbox.setAttribute('role', 'textbox');
  textbox.setAttribute('aria-readonly', String(readonly));
  document.body.appendChild(textbox);
  wrappers.push(textbox);

  const onChange = vi.fn();

  const { component } = await render(InlinePatternComponent, {
    target: textbox,
    props: /** @type {any} */ ({
      componentName: 'x-wikilink',
      label: 'Wikilink',
      toPreview,
      toInline,
      values: { page: 'Home' },
      onChange,
      ...props,
    }),
  });

  return { onChange, textbox, component };
};

describe('InlinePatternComponent', () => {
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.remove());
  });

  test('renders the string preview within the text', async () => {
    await renderComponent({});

    const wrapper = page.getByRole('group', { name: 'Wikilink' });

    await expect.element(wrapper).toHaveAttribute('contenteditable', 'false');
    await expect.element(wrapper).toHaveAttribute('data-component-name', 'x-wikilink');
    await expect.element(wrapper).toHaveAttribute('title', 'Wikilink');
    await expect.element(wrapper).toHaveTextContent('Home');
    // The preview stays readable by assistive technology
    await expect
      .element(wrapper.getByRole('link', { name: 'Home' }))
      .toHaveAttribute('href', '/Home');
  });

  test('takes the accessible name of an editable component from its preview', async () => {
    await renderComponent({ onEdit: vi.fn(async () => null) });

    const button = page.getByRole('button', { name: 'Home' });

    await expect.element(button).toHaveAccessibleDescription('Wikilink');
    await expect.element(button).not.toHaveAttribute('aria-label');
  });

  test('shows the Markdown without a preview', async () => {
    await renderComponent({ toPreview: undefined });
    await expect
      .element(page.getByRole('group', { name: 'Wikilink' }))
      .toHaveTextContent('[[Home]]');
  });

  test('renders a React element preview', async () => {
    await renderComponent({
      toPreview: (/** @type {Record<string, any>} */ { page: name }) =>
        createElement('mark', { className: 'react-preview' }, name),
    });

    await expect.poll(() => document.querySelector('.react-preview')?.textContent).toBe('Home');
  });

  test('can’t be edited without `onEdit`, only removed', async () => {
    const { onChange } = await renderComponent({});
    const wrapper = page.getByRole('group', { name: 'Wikilink' });

    await wrapper.click();
    expect(onChange).not.toHaveBeenCalled();

    /** @type {HTMLElement} */ (wrapper.element()).focus();
    await userEvent.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].type).toBe('remove');
  });

  test('updates the data with the result of `onEdit` on click', async () => {
    const onEdit = vi.fn(async () => ({ page: 'About' }));
    const { onChange } = await renderComponent({ onEdit });
    const button = page.getByRole('button');

    await button.click();

    expect(onEdit).toHaveBeenCalledExactlyOnceWith({ data: { page: 'Home' } });
    await expect.element(button).toHaveTextContent('About');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].type).toBe('update');
    expect(onChange.mock.calls[0][0].detail).toEqual({ page: 'About' });
  });

  test('calls `onEdit` with the Enter and Space keys', async () => {
    const onEdit = vi.fn(async () => null);
    const { onChange } = await renderComponent({ onEdit });

    /** @type {HTMLElement} */ (page.getByRole('button').element()).focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => onEdit.mock.calls.length).toBe(1);
    await userEvent.keyboard(' ');
    await expect.poll(() => onEdit.mock.calls.length).toBe(2);

    // `null` leaves the component unchanged
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole('button')).toHaveTextContent('Home');
  });

  test('doesn’t call `onEdit` again while it’s in progress', async () => {
    /** @type {any} */
    let resolve;

    const onEdit = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    await renderComponent({ onEdit });

    const button = page.getByRole('button');

    await button.click();
    await button.click();
    expect(onEdit).toHaveBeenCalledOnce();

    resolve({ page: 'About' });
    await expect.element(button).toHaveTextContent('About');
    await button.click();
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  test('logs an error thrown by `onEdit`', async () => {
    const error = new Error('Failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onEdit = vi.fn(() => Promise.reject(error));
    const { onChange } = await renderComponent({ onEdit });

    await page.getByRole('button').click();

    await expect.poll(() => consoleError.mock.calls.length).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(error);
    expect(onChange).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('can’t be edited or removed in a read-only field', async () => {
    const onEdit = vi.fn();
    const { onChange } = await renderComponent({ onEdit }, { readonly: true });
    const button = page.getByRole('button');

    // The read-only state is looked up once the component is in place
    await expect.poll(() => button.element().classList.contains('editable')).toBe(false);
    await button.click();
    /** @type {HTMLElement} */ (button.element()).focus();
    await userEvent.keyboard('{Delete}');

    expect(onEdit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows the data set by the node', async () => {
    const { component } = await renderComponent({});

    expect(component.getElement()).toBe(
      document.querySelector('[data-component-name="x-wikilink"]'),
    );

    component.setValues({ page: 'Blog' });

    await expect.element(page.getByRole('group', { name: 'Wikilink' })).toHaveTextContent('Blog');
  });

  test('can be removed without a change handler', async () => {
    await renderComponent({ onChange: undefined });

    const wrapper = page.getByRole('group', { name: 'Wikilink' });

    /** @type {HTMLElement} */ (wrapper.element()).focus();
    await userEvent.keyboard('{Backspace}');
    await expect.element(wrapper).toBeInTheDocument();
  });

  test('shows empty data for a new component', async () => {
    await renderComponent({ toPreview: undefined, values: undefined });
    await expect.element(page.getByRole('group', { name: 'Wikilink' })).toHaveTextContent('[[]]');
  });
});
