import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ObjectBody from './object-body.svelte';

/**
 * Build the props of a collapsed body.
 * @param {Record<string, any>} [overrides] Props to override.
 * @returns {any} Props.
 */
const getProps = (overrides = {}) => ({
  locale: '_default',
  subFields: [{ name: 'title', widget: 'string' }],
  getSubFieldProps: vi.fn(),
  expanded: false,
  unknownType: false,
  getSummary: vi.fn(() => 'Hello'),
  getThumbnail: vi.fn(() => undefined),
  ...overrides,
});

describe('ObjectBody', () => {
  test('warns about a type the field doesn’t define instead of showing anything', async () => {
    const getSummary = vi.fn(() => 'Hello');

    await render(ObjectBody, getProps({ unknownType: true, getSummary }));

    await expect.element(page.getByRole('alert')).toMatchTextContent(/due to an unknown type/);
    expect(getSummary).not.toHaveBeenCalled();
  });

  test('shows the summary while collapsed', async () => {
    const { container } = await render(ObjectBody, getProps({ summaryId: 'object-1-summary' }));
    const summary = /** @type {HTMLElement} */ (container.querySelector('.summary'));

    await expect.element(summary).toHaveTextContent('Hello');
    expect(summary.id).toBe('object-1-summary');
    expect(summary.querySelector('img')).toBeNull();
  });

  test('shows the thumbnail along with the summary', async () => {
    const url = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

    const { container } = await render(
      ObjectBody,
      getProps({ getThumbnail: vi.fn(() => ({ url })) }),
    );

    await expect.poll(() => container.querySelector('.summary img')?.getAttribute('src')).toBe(url);
  });

  test('shows nothing while collapsed when there is no summary or thumbnail', async () => {
    const { container } = await render(ObjectBody, getProps({ getSummary: vi.fn(() => '') }));

    expect(container.querySelector('.summary')).toBeNull();
  });

  test('draws the given content in place of the summary text', async () => {
    const getSummary = vi.fn(() => 'Hello');
    const url = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

    const summaryContent = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<strong class="custom">Custom summary</strong>',
    }));

    const { container } = await render(
      ObjectBody,
      getProps({ getSummary, getThumbnail: vi.fn(() => ({ url })), summaryContent }),
    );

    const summary = /** @type {HTMLElement} */ (container.querySelector('.summary'));

    await expect.element(summary).toHaveTextContent('Custom summary');
    expect(summary.querySelector('.custom')).not.toBeNull();
    // The thumbnail is still shown beside it
    await expect.poll(() => summary.querySelector('img')?.getAttribute('src')).toBe(url);
    expect(getSummary).not.toHaveBeenCalled();
  });
});
