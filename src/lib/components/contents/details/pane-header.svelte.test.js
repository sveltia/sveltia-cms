import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { getCollection } from '$lib/services/contents/collection';
import { deployPollTimedOut } from '$lib/services/deployments';
import { recheckDeployments } from '$lib/services/deployments/poll';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';
import { openNewTab } from '$lib/services/utils/window';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PaneHeader from './pane-header.svelte';

vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));
vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

const fields = [{ name: 'title', widget: 'string' }];

const i18n = {
  i18nEnabled: true,
  saveAllLocales: false,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the header.
 * @param {object} [options] Options.
 * @param {any} [options.i18nConfig] I18n configuration.
 * @param {Record<string, any>} [options.draftProps] Draft properties to override.
 * @param {any} [options.thisPane] This pane’s state.
 * @param {any} [options.thatPane] The other pane’s state.
 * @returns {Promise<{ draft: any, thisPane: any }>} Draft and pane.
 */
const renderHeader = async ({
  i18nConfig = i18n,
  draftProps = {},
  thisPane = createRawState(/** @type {any} */ ({ mode: 'edit', locale: 'en' })),
  thatPane = createRawState(/** @type {any} */ ({ mode: 'preview', locale: 'en' })),
} = {}) => {
  const draft = createMockDraft({
    fields,
    i18n: i18nConfig,
    values: Object.fromEntries(
      i18nConfig.allLocales.map((/** @type {string} */ locale) => [locale, { title: 'Hello' }]),
    ),
    draft: { collection: getCollection('posts'), ...draftProps },
  });

  await renderWithDraft(PaneHeader, {
    draft,
    props: { id: 'pane-1-header', thisPane, thatPane },
  });

  return { draft, thisPane };
};

/**
 * Open the content options menu.
 * @param {string} [locale] Locale label.
 * @returns {Promise<import('vitest/browser').Locator>} Menu.
 */
const openMenu = async (locale = 'English') => {
  await page.getByRole('button', { name: `Show \u2068${locale}\u2069 Content Options` }).click();
  // A Sveltia UI menu starts handling clicks 100 ms after it’s opened
  await sleep(150);

  return page.getByRole('menu', { name: `\u2068${locale}\u2069 Content Options` });
};

describe('PaneHeader', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      i18n: {
        structure: /** @type {const} */ ('multiple_folders'),
        locales: ['en', 'fr'],
        default_locale: 'en',
        save_all_locales: false,
      },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          preview_path: 'posts/{{slug}}',
          i18n: true,
          fields,
        },
        { name: 'pages', label: 'Pages', folder: 'content/pages', fields },
      ],
    });
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    prefs.devModeEnabled = false;
    backendName.current = undefined;
    unpublishedEntries.current = [];
    deployPollTimedOut.current = false;
  });

  test('offers the locale switcher and content options', async () => {
    const { draft } = await renderHeader();
    const toolbar = page.getByRole('toolbar', { name: 'Secondary' });

    await expect.element(toolbar.getByRole('radiogroup', { name: 'Switch Locale' })).toBeVisible();
    await expect
      .element(toolbar.getByRole('button', { name: 'Translate from \u2068French\u2069' }))
      .toBeEnabled();

    const menu = await openMenu();

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Copy from \u2068French\u2069', 'Revert Changes', 'Disable \u2068English\u2069']);
    await expect.element(menu.getByRole('menuitem', { name: 'Revert Changes' })).toBeDisabled();
    // The default locale can’t be disabled
    await expect
      .element(menu.getByRole('menuitem', { name: 'Disable \u2068English\u2069' }))
      .toBeDisabled();

    draft.currentValues.en.title = 'Hi';
    await expect.element(menu.getByRole('menuitem', { name: 'Revert Changes' })).toBeEnabled();
    await menu.getByRole('menuitem', { name: 'Revert Changes' }).click();
    await expect.poll(() => draft.currentValues.en.title).toBe('Hello');
  });

  test('disables and reenables a locale', async () => {
    const { draft } = await renderHeader({
      thisPane: createRawState({ mode: 'edit', locale: 'fr' }),
    });

    await (
      await openMenu('French')
    )
      .getByRole('menuitem', { name: 'Disable \u2068French\u2069' })
      .click();
    expect(draft.currentLocales.fr).toBe(false);

    await expect.poll(() => document.querySelector('dialog.popup')).toBeNull();
    await (
      await openMenu('French')
    )
      .getByRole('menuitem', { name: 'Reenable \u2068French\u2069' })
      .click();
    expect(draft.currentLocales.fr).toBe(true);
  });

  test('links to the entry on the live site', async () => {
    await renderHeader({
      draftProps: {
        isNew: false,
        originalEntry: createMockEntry({ slug: 'hello', content: { en: {}, fr: {} } }),
      },
    });

    const menu = await openMenu();

    await expect.element(menu.getByRole('menuitem', { name: 'View on Live Site' })).toBeEnabled();
    expect(menu.element().querySelectorAll('[role="separator"]')).toHaveLength(2);
  });

  test('offers the repository link in developer mode', async () => {
    prefs.devModeEnabled = true;

    await renderHeader({
      draftProps: { isNew: false, originalEntry: createMockEntry({ slug: 'hello' }) },
    });

    const menu = await openMenu();

    // The test backend has no repository
    await expect.element(menu.getByRole('menuitem', { name: 'View in Repository' })).toBeDisabled();
  });

  test('opens the entry file in the repository', async () => {
    prefs.devModeEnabled = true;
    backendName.current = 'github';
    Object.assign(repository, {
      label: 'GitHub',
      blobBaseURL: 'https://github.com/me/site/blob/main',
    });

    try {
      await renderHeader({
        draftProps: {
          isNew: false,
          originalEntry: createMockEntry({ slug: 'hello', content: { en: { title: 'Hello' } } }),
        },
      });

      const menu = await openMenu();

      await menu.getByRole('menuitem', { name: 'View on \u2068GitHub\u2069' }).click();
      expect(openNewTab).toHaveBeenCalledWith(
        'https://github.com/me/site/blob/main/content/posts/hello.md?plain=1',
      );
    } finally {
      Object.assign(repository, { label: '', blobBaseURL: '' });
    }
  });

  test('offers to check for the preview again once the checks have given up', async () => {
    deployPollTimedOut.current = true;

    await renderHeader({
      draftProps: { isNew: false, originalEntry: createMockEntry({ slug: 'hello' }) },
    });

    const menu = await openMenu();

    await menu.getByRole('menuitem', { name: 'Check for Preview' }).click();
    expect(recheckDeployments).toHaveBeenCalled();
  });

  test('passes the pull request on to the preview link with Editorial Workflow', async () => {
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site' },
      publish_mode: 'editorial_workflow',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          preview_path: 'posts/{{slug}}',
          fields,
        },
      ],
    });
    backendName.current = 'github';

    const entry = createMockEntry({ slug: 'hello' });

    unpublishedEntries.current = [
      /** @type {any} */ ({
        ...entry,
        workflow: {
          status: 'draft',
          collectionName: 'posts',
          pullRequest: { number: 1, branch: 'cms/posts/hello', url: 'https://github.com/pr/1' },
        },
      }),
    ];

    await renderHeader({
      i18nConfig: { i18nEnabled: false, allLocales: ['_default'], defaultLocale: '_default' },
      draftProps: { isNew: false, originalEntry: entry },
      thisPane: createRawState(/** @type {any} */ ({ mode: 'edit', locale: '_default' })),
    });

    const menu = await openMenu('_default');

    await expect.element(menu.getByRole('menuitem', { name: 'View on Live Site' })).toBeVisible();
  });

  test('shows the mode without i18n on a large screen', async () => {
    const { container } = await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: 'Hello' } },
        draft: { collection: getCollection('pages') },
      }),
      props: {
        id: 'pane-1-header',
        thisPane: createRawState({ mode: 'edit', locale: '_default' }),
        thatPane: createRawState({ mode: 'preview', locale: '_default' }),
      },
    });

    expect(container.querySelector('h3')).toHaveTextContent('Edit');

    const preview = await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: 'Hello' } },
        draft: { collection: getCollection('pages') },
      }),
      props: {
        id: 'pane-2-header',
        thisPane: createRawState({ mode: 'preview', locale: '_default' }),
      },
    });

    expect(preview.container.querySelector('h3')).toHaveTextContent('Preview');
    expect(page.getByRole('radiogroup').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: /Translate/ }).elements()).toHaveLength(0);

    const menu = await openMenu('_default');

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Revert Changes']);
  });

  test('offers the preview toggle with i18n on a medium screen', async () => {
    env.isMediumScreen = true;

    // The other pane is optional
    await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        fields,
        i18n,
        values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
        draft: { collection: getCollection('posts') },
      }),
      props: { id: 'pane-1-header', thisPane: createRawState({ mode: 'edit', locale: 'en' }) },
    });

    // The locale switcher is compact on a medium screen
    await expect.element(page.getByRole('combobox', { name: 'Switch Locale' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Preview' })).toBeVisible();
  });

  test('has no divider without a preview link', async () => {
    // The Pages collection has no preview path
    await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: 'Hello' } },
        draft: {
          collection: getCollection('pages'),
          isNew: false,
          originalEntry: createMockEntry({ slug: 'hello', folder: 'content/pages' }),
        },
      }),
      props: {
        id: 'pane-1-header',
        thisPane: createRawState({ mode: 'edit', locale: '_default' }),
      },
    });

    const menu = await openMenu('_default');

    expect(menu.element().querySelectorAll('[role="separator"]')).toHaveLength(0);
  });

  test('shows nothing but the switcher on a small screen without a preview', async () => {
    env.isSmallScreen = true;

    const { container } = await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: 'Hello' } },
        draft: { collection: getCollection('pages'), canPreview: false },
      }),
      props: {
        id: 'pane-1-header',
        thisPane: createRawState({ mode: 'edit', locale: '_default' }),
      },
    });

    await expect.element(page.getByRole('toolbar', { name: 'Secondary' })).toBeVisible();
    expect(container.querySelector('h3')).toBeNull();
    expect(page.getByRole('button', { name: 'Preview' }).elements()).toHaveLength(0);
  });

  test('offers the preview toggle on a small screen', async () => {
    env.isSmallScreen = true;

    const thisPane = createRawState({ mode: 'edit', locale: '_default' });

    await renderWithDraft(PaneHeader, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: 'Hello' } },
        draft: { collection: getCollection('pages') },
      }),
      props: { id: 'pane-1-header', thisPane, thatPane: createRawState(null) },
    });

    await page.getByRole('button', { name: 'Preview' }).click();
    expect(thisPane.current).toEqual({ mode: 'preview', locale: '_default' });
    // The content options are for editing
    expect(page.getByRole('button', { name: /Content Options/ }).elements()).toHaveLength(0);
  });

  test('disables the options for an entry awaiting deletion', async () => {
    await renderHeader({
      draftProps: {
        isNew: false,
        originalEntry: {
          ...createMockEntry({ slug: 'hello' }),
          workflow: { status: 'pending_deletion' },
        },
      },
    });

    await expect
      .element(page.getByRole('button', { name: 'Show \u2068English\u2069 Content Options' }))
      .toBeDisabled();
  });
});
