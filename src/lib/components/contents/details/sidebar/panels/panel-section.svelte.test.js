import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import PanelSection from './panel-section.svelte';

/**
 * Create a snippet rendering a text field labelled by the given label element.
 * @returns {import('svelte').Snippet<[string]>} Snippet.
 */
const createChildren = () =>
  createRawSnippet((/** @type {() => string} */ getLabelId) => ({
    /**
     * Render the content.
     * @returns {string} HTML.
     */
    render: () => `<input type="text" aria-labelledby="${getLabelId()}" />`,
  }));

describe('PanelSection', () => {
  test('renders a group headed with its label', async () => {
    await render(PanelSection, { label: 'English', children: createChildren() });

    const group = page.getByRole('group', { name: 'English' });

    await expect.element(group).toBeInTheDocument();
    await expect.element(group.getByRole('heading', { level: 4 })).toHaveTextContent('English');
    // The content is given the ID of the heading to label a field with
    await expect.element(group.getByRole('textbox', { name: 'English' })).toBeInTheDocument();
    expect(group.element().tagName).toBe('SECTION');
  });

  test('keeps a hidden label for assistive technology without a heading', async () => {
    await render(PanelSection, {
      label: 'Slug',
      showLabel: false,
      children: createChildren(),
    });

    // The section is not a group of its own, and has no visible heading
    expect(page.getByRole('group').elements()).toHaveLength(0);
    expect(page.getByRole('heading').elements()).toHaveLength(0);

    const section = /** @type {HTMLElement} */ (document.querySelector('section.section'));

    expect(section.getAttribute('role')).toBe('none');
    expect(section.hasAttribute('aria-labelledby')).toBe(false);

    const label = /** @type {HTMLElement} */ (section.querySelector('span[hidden]'));

    expect(label.textContent).toBe('Slug');
    await expect.element(page.getByRole('textbox', { name: 'Slug' })).toBeInTheDocument();
    expect(page.getByRole('textbox').element().getAttribute('aria-labelledby')).toBe(label.id);
  });

  test('gives each section a label ID of its own', async () => {
    await render(PanelSection, { label: 'English', children: createChildren() });
    await render(PanelSection, { label: 'French', children: createChildren() });

    const ids = page
      .getByRole('heading', { level: 4 })
      .elements()
      .map((el) => el.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    await expect.element(page.getByRole('textbox', { name: 'French' })).toBeInTheDocument();
  });
});
