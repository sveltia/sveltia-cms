import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { openNewTab } from '$lib/services/utils/window';
import { createMockEntry, initTestConfig } from '$lib/test/config';

import EntryStatusCell from './entry-status-cell.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));
// Never reach the network for a liveness check
vi.mock('$lib/services/deployments/ping', async (importOriginal) => {
  /** @type {typeof import('$lib/services/deployments/ping')} */
  const actual = await importOriginal();

  return { ...actual, pingURL: vi.fn() };
});

/**
 * Create an unpublished entry in a pull request.
 * @param {string} slug Entry slug.
 * @returns {any} Entry.
 */
const createUnpublishedEntry = (slug) =>
  createMockEntry({
    slug,
    entry: /** @type {any} */ ({
      workflow: { status: 'pending_review', pullRequest: { number: 1, headSHA: 'abc' } },
    }),
  });

describe('EntryStatusCell', () => {
  beforeAll(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          preview_path: 'posts/{{slug}}',
          fields: [{ name: 'title', widget: 'string' }],
        },
        {
          name: 'settings',
          files: [
            {
              name: 'general',
              file: 'data/general.yml',
              preview_path: 'settings',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      ],
    });
  });

  beforeEach(() => {
    deployments.current = {
      abc: { state: 'ready', url: 'https://preview.example.com', checkedTime: 0 },
    };
    productionSHA.current = '';
    deployPollTimedOut.current = false;
  });

  test('shows nothing for a published entry', async () => {
    const { container } = await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('posts')),
      subPath: 'hello',
      showPreviewLink: true,
    });

    expect(container.querySelector('.status-items')).toHaveTextContent('');
    expect(container.querySelector('.status-items *')).toBeNull();
  });

  test('shows the status of an unpublished entry, with or without its preview link', async () => {
    const collection = /** @type {any} */ (getCollection('posts'));
    const unpublishedEntry = createUnpublishedEntry('hello');

    const { container, rerender } = await render(EntryStatusCell, {
      collection,
      subPath: 'hello',
      unpublishedEntry,
    });

    expect(container.querySelector('.status-items')).toHaveTextContent('In Review');
    expect(page.getByRole('button').elements()).toHaveLength(0);

    await rerender({ showPreviewLink: true });
    await expect.element(page.getByRole('button', { name: 'View Preview' })).toBeVisible();
  });

  test('opens the deploy preview without passing the click on to the row', async () => {
    const onRowClick = vi.fn();

    await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('posts')),
      subPath: 'hello',
      unpublishedEntry: createUnpublishedEntry('hello'),
      showPreviewLink: true,
    });

    document.body.addEventListener('click', onRowClick);

    try {
      const button = page.getByRole('button', { name: 'View Preview' });

      // Out of the Tab order, like the row’s checkbox
      await expect.element(button).toHaveAttribute('tabindex', '-1');
      await button.click();
      expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/posts/hello');
      expect(onRowClick).not.toHaveBeenCalled();
    } finally {
      document.body.removeEventListener('click', onRowClick);
    }
  });

  test('opens the deploy preview of a file in a file collection', async () => {
    const collection = /** @type {any} */ (getCollection('settings'));

    await render(EntryStatusCell, {
      collection,
      subPath: 'general',
      unpublishedEntry: createUnpublishedEntry('general'),
      collectionFile: getCollectionFile(collection, 'general'),
      showPreviewLink: true,
    });

    await page.getByRole('button', { name: 'View Preview' }).click();
    expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/settings');
  });
});
