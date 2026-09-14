import { createElement } from 'react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import CustomPreview from './custom-preview.svelte';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
  loadModule: vi.fn(() => import('immutable')),
  getChunkURLs: vi.fn(() => []),
  loadChunk: vi.fn(() => import('$lib/chunks/react-dom.js')),
}));

const fieldConfig = { name: 'stars', widget: 'rating', label: 'Stars', max: 5 };

/**
 * A Netlify/Decap CMS-compatible preview component.
 * @param {any} props Props.
 * @returns {any} React element.
 */
const RatingPreview = ({ value, field, entry, metadata }) =>
  createElement(
    'p',
    { className: 'rating' },
    `${'★'.repeat(value)} (${field.get('max')}) for ${entry.getIn(['data', 'title'])} ${metadata.size}`,
  );

describe('CustomPreview', () => {
  beforeAll(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }, fieldConfig],
        },
      ],
    });
  });

  test('renders the React preview with the Netlify/Decap CMS-compatible props', async () => {
    const draft = createMockDraft({
      fields: [{ name: 'title', widget: 'string' }, fieldConfig],
      values: { _default: { title: 'Hello', stars: 3 } },
    });

    const props = $state({
      locale: '_default',
      keyPath: 'stars',
      fieldConfig,
      currentValue: 3,
      preview: RatingPreview,
    });

    await renderWithDraft(CustomPreview, { draft, props });

    await expect.element(page.getByText('★★★ (5) for Hello 0')).toBeInTheDocument();

    // The preview follows the value
    props.currentValue = 4;
    await expect.element(page.getByText('★★★★ (5) for Hello 0')).toBeInTheDocument();

    // And the other fields of the entry
    draft.currentValues._default.title = 'Hi';
    await expect.element(page.getByText('★★★★ (5) for Hi 0')).toBeInTheDocument();
  });

  test('renders nothing without a preview component', async () => {
    const draft = createMockDraft({
      fields: [fieldConfig],
      values: { _default: { stars: 3 } },
    });

    const { container } = await renderWithDraft(CustomPreview, {
      draft,
      props: { locale: '_default', keyPath: 'stars', fieldConfig, currentValue: 3 },
    });

    await expect.poll(() => container.querySelector('div')?.children.length).toBe(0);
  });
});
