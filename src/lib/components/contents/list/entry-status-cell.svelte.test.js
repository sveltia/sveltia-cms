import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { resolveEntryPreviewLink } from '$lib/services/deployments/control';
import { pingURL } from '$lib/services/deployments/ping';
import { openNewTab } from '$lib/services/utils/window';
import { createMockEntry, initTestConfig } from '$lib/test/config';

import EntryStatusCell from './entry-status-cell.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));
// Spy on the link resolution while still running it
vi.mock('$lib/services/deployments/control', async (importOriginal) => {
  /** @type {typeof import('$lib/services/deployments/control')} */
  const actual = await importOriginal();

  return { ...actual, resolveEntryPreviewLink: vi.fn(actual.resolveEntryPreviewLink) };
});
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
          name: 'notes',
          folder: 'content/notes',
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

  test('shows nothing for a collection file that hasn’t been created yet', async () => {
    const { container } = await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('settings')),
      subPath: 'general',
      showPreviewLink: true,
    });

    expect(container.querySelector('.status-items')).toHaveTextContent('');
    expect(container.querySelector('.status-items *')).toBeNull();
  });

  test('links a published entry to the live site, without checking that the page is live', async () => {
    const { container } = await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('posts')),
      subPath: 'hello',
      entry: createMockEntry({ slug: 'hello' }),
      showPreviewLink: true,
    });

    // A published entry has no status
    expect(container.querySelector('.status-badge')).toBeNull();
    await page.getByRole('button', { name: 'View on Live Site' }).click();
    expect(openNewTab).toHaveBeenCalledWith('https://example.com/posts/hello');
    // A request for every published row would be a burst the site doesn’t need
    expect(pingURL).not.toHaveBeenCalled();

    // Nor is the row updated by each answer of the deploy state lookup
    const resolutions = vi.mocked(resolveEntryPreviewLink).mock.calls.length;

    deployments.current = { ...deployments.current, def: { state: 'pending', checkedTime: 1 } };
    productionSHA.current = 'def';
    flushSync();
    expect(resolveEntryPreviewLink).toHaveBeenCalledTimes(resolutions);
  });

  test('offers no link for an entry without a page', async () => {
    const { container } = await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('notes')),
      subPath: 'hello',
      entry: createMockEntry({ slug: 'hello', folder: 'content/notes' }),
      showPreviewLink: true,
    });

    // Without the `preview_path` option, the entry has no page on the live site
    expect(page.getByRole('button').elements()).toHaveLength(0);
    // The click catcher left behind takes no space, so it adds no gap to the row
    expect(
      [...(container.querySelector('.status-items')?.children ?? [])].map(
        (el) => getComputedStyle(el).display,
      ),
    ).toEqual(['contents']);
  });

  test('shows the status of an unpublished entry, with or without its preview link', async () => {
    const collection = /** @type {any} */ (getCollection('posts'));
    const entry = createUnpublishedEntry('hello');

    const { container, rerender } = await render(EntryStatusCell, {
      collection,
      subPath: 'hello',
      entry,
    });

    expect(container.querySelector('.status-items')).toHaveTextContent('In Review');
    expect(page.getByRole('button').elements()).toHaveLength(0);

    await rerender({ showPreviewLink: true });
    await expect.element(page.getByRole('button', { name: 'View Preview' })).toBeVisible();

    // The button comes last, so the buttons line up from row to row whether or not there’s a status
    expect(
      [...container.querySelectorAll('.status-badge, button')].map((el) =>
        el.tagName.toLowerCase(),
      ),
    ).toEqual(['span', 'button']);
  });

  test('opens the deploy preview without passing the click on to the row', async () => {
    const onRowClick = vi.fn();

    await render(EntryStatusCell, {
      collection: /** @type {any} */ (getCollection('posts')),
      subPath: 'hello',
      entry: createUnpublishedEntry('hello'),
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
      // An unpublished entry’s page is checked, as there are only a few of them
      expect(pingURL).toHaveBeenCalledWith('https://preview.example.com/posts/hello', {
        recheckPending: true,
      });
    } finally {
      document.body.removeEventListener('click', onRowClick);
    }
  });

  test('opens the deploy preview of a file in a file collection', async () => {
    const collection = /** @type {any} */ (getCollection('settings'));

    await render(EntryStatusCell, {
      collection,
      subPath: 'general',
      entry: createUnpublishedEntry('general'),
      collectionFile: getCollectionFile(collection, 'general'),
      showPreviewLink: true,
    });

    await page.getByRole('button', { name: 'View Preview' }).click();
    expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/settings');
  });
});
