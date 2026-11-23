import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import ApiKeySection from './api-key-section.svelte';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

// The real module loads the preferences from local storage and applies them to the document in
// root effects, which have nothing to do with the section
vi.mock('$lib/services/user/prefs.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { prefs: createState({}) };
});

const entries = /** @type {[string, TranslationService][]} */ ([
  ['google', { serviceId: 'google', serviceLabel: 'Google' }],
  ['deepl', { serviceId: 'deepl', serviceLabel: 'DeepL' }],
]);

/**
 * Get the accessible label of a service’s API key input.
 * @param {string} service Service label.
 * @returns {string} Input label.
 */
const getFieldLabel = (service) => `${service} key`;

describe('ApiKeySection', () => {
  test('shows the heading, the description with a docs link and an input per service', async () => {
    const onChange = vi.fn();

    const { container } = await render(ApiKeySection, {
      title: 'API Keys',
      description: 'See <a>the docs</a>.',
      docsURL: 'https://example.com/docs',
      entries,
      getFieldLabel,
      onChange,
    });

    expect(container.querySelector('h3')).toHaveTextContent('API Keys');
    expect(container.querySelector('p a')).toHaveAttribute('href', 'https://example.com/docs');
    expect([...container.querySelectorAll('h4')].map((h4) => h4.textContent)).toEqual([
      'Google',
      'DeepL',
    ]);

    const input = page.getByRole('textbox', { name: 'DeepL key' });

    await input.fill('abc');
    await input.element().blur();
    expect(onChange).toHaveBeenCalledWith({ message: 'API key saved.', status: 'success' });
  });

  test('shows only the description without services', async () => {
    const { container } = await render(ApiKeySection, {
      title: 'API Keys',
      description: 'No services.',
      docsURL: 'https://example.com/docs',
      entries: [],
      getFieldLabel,
    });

    expect(container.querySelector('p')).toHaveTextContent('No services.');
    expect(container.querySelectorAll('h4')).toHaveLength(0);
  });
});
