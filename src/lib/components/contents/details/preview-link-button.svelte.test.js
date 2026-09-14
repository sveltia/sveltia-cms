import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection } from '$lib/services/contents/collection';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { pageLiveness } from '$lib/services/deployments/ping';
import { openNewTab } from '$lib/services/utils/window';
import { createMockEntry, initTestConfig } from '$lib/test/config';

import PreviewLinkButton from './preview-link-button.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

const entry = createMockEntry({ slug: 'hello' });
const pullRequest = /** @type {any} */ ({ number: 1, headSHA: 'abc' });

/**
 * Render the button.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<void>}
 */
const renderButton = async (props = {}) => {
  await render(PreviewLinkButton, {
    entry,
    locale: '_default',
    collection: /** @type {any} */ (getCollection('posts')),
    ...props,
  });
};

describe('PreviewLinkButton', () => {
  beforeAll(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          preview_path: 'posts/{{slug}}',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
  });

  beforeEach(() => {
    deployments.current = {};
    productionSHA.current = '';
    deployPollTimedOut.current = false;
    pageLiveness.current = {};
  });

  test('links to the entry on the live site', async () => {
    await renderButton();

    const button = page.getByRole('button', { name: 'View on Live Site' });

    await expect.element(button).toBeEnabled();
    await expect.element(button).not.toHaveAttribute('aria-description');

    await button.click();
    expect(openNewTab).toHaveBeenCalledWith('https://example.com/posts/hello');
  });

  test('can be an icon button or a menu item', async () => {
    await renderButton({ iconic: true });
    await expect.element(page.getByRole('button', { name: 'View on Live Site' })).toBeEnabled();

    await renderButton({ as: 'menuitem' });
    await expect.element(page.getByRole('menuitem', { name: 'View on Live Site' })).toBeEnabled();
  });

  test('links to the deploy preview of an unpublished entry', async () => {
    deployments.current = {
      abc: { state: 'ready', url: 'https://preview.example.com', checkedTime: 0 },
    };

    await renderButton({ pullRequest });

    const button = page.getByRole('button', { name: 'View Preview' });

    await expect.element(button).toBeEnabled();
    await button.click();
    expect(openNewTab).toHaveBeenCalledWith('https://preview.example.com/posts/hello');
  });

  test('waits while the preview is being built', async () => {
    deployments.current = { abc: { state: 'pending', checkedTime: 0 } };

    await renderButton({ pullRequest });

    const button = page.getByRole('button', { name: 'Checking for Preview' });

    await expect.element(button).toBeDisabled();
    await expect
      .element(button)
      .toHaveAttribute('aria-description', 'The preview is still being built.');

    // The live site link is offered once the checks have given up
    deployPollTimedOut.current = true;
    await expect.element(page.getByRole('button', { name: 'View on Live Site' })).toBeEnabled();
  });

  test('says that the preview is being checked', async () => {
    deployments.current = { abc: { state: 'checking', checkedTime: 0 } };

    await renderButton({ pullRequest });

    await expect
      .element(page.getByRole('button', { name: 'Checking for Preview' }))
      .toHaveAttribute('aria-description', 'Checking for a preview…');
  });

  test('says why a failed preview can’t be opened', async () => {
    deployments.current = {
      abc: { state: 'error', url: 'https://ci.example.com/log', checkedTime: 0 },
    };

    await renderButton({ pullRequest });

    const button = page.getByRole('button', { name: 'View Preview' });

    await expect.element(button).toBeDisabled();
    await expect
      .element(button)
      .toHaveAttribute('aria-description', 'The preview couldn’t be built.');
  });

  test('checks whether the page is served', async () => {
    // The live site is on another origin, so it can’t be checked. The result of a check is cached,
    // so a URL that hasn’t been checked in the other tests is used
    await renderButton({ entry: createMockEntry({ slug: 'world' }) });
    await expect
      .poll(() => pageLiveness.current)
      .toEqual({
        'https://example.com/posts/world': 'unknown',
      });
  });

  test('renders nothing without a preview path', async () => {
    const { container } = await render(PreviewLinkButton, {
      entry: createMockEntry({ slug: 'about', folder: 'content/pages' }),
      locale: '_default',
      collection: /** @type {any} */ ({ ...getCollection('posts'), preview_path: undefined }),
    });

    expect(container.querySelector('button')).toBeNull();
  });
});
