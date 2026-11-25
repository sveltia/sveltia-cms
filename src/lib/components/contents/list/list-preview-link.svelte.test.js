import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { retainDeployPolling } from '$lib/services/deployments/poll';
import { openNewTab } from '$lib/services/utils/window';
import { createMockEntry, initTestConfig } from '$lib/test/config';

import ListPreviewLink from './list-preview-link.svelte';

const { release } = vi.hoisted(() => ({ release: vi.fn() }));

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));
vi.mock('$lib/services/deployments/poll', () => ({ retainDeployPolling: vi.fn(() => release) }));
// Never reach the network for a liveness check
vi.mock('$lib/services/deployments/ping', async (importOriginal) => {
  /** @type {typeof import('$lib/services/deployments/ping')} */
  const actual = await importOriginal();

  return { ...actual, pingURL: vi.fn() };
});

const pullRequest = /** @type {any} */ ({ number: 1, headSHA: 'abc' });

describe('ListPreviewLink', () => {
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

  test('opens the deploy preview of the entry without passing the click on', async () => {
    const onRowClick = vi.fn();

    const entry = createMockEntry({
      slug: 'hello',
      entry: { workflow: /** @type {any} */ ({ pullRequest }) },
    });

    const { unmount } = await render(ListPreviewLink, {
      collection: /** @type {any} */ (getCollection('posts')),
      entry: /** @type {any} */ (entry),
    });

    document.body.addEventListener('click', onRowClick);

    const button = page.getByRole('button', { name: 'View Preview' });

    // Out of the Tab order, like the row’s checkbox
    await expect.element(button).toHaveAttribute('tabindex', '-1');
    await button.click();
    expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/posts/hello');
    expect(onRowClick).not.toHaveBeenCalled();
    document.body.removeEventListener('click', onRowClick);

    // The deploy state is kept up to date while the button is shown
    expect(retainDeployPolling).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
    unmount();
    expect(release).toHaveBeenCalledOnce();
  });

  test('opens the deploy preview of a file in a file collection', async () => {
    const collection = /** @type {any} */ (getCollection('settings'));

    const entry = createMockEntry({
      slug: 'general',
      entry: { workflow: /** @type {any} */ ({ pullRequest }) },
    });

    await render(ListPreviewLink, {
      collection,
      entry: /** @type {any} */ (entry),
      collectionFile: getCollectionFile(collection, 'general'),
    });

    await page.getByRole('button', { name: 'View Preview' }).click();
    expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/settings');
  });
});
