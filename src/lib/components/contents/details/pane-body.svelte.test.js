import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { customPreviewStyleRegistry } from '$lib/services/api/registries';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { createRawState } from '$lib/services/utils/state.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PaneBody from './pane-body.svelte';

const fields = [{ name: 'title', label: 'Title', widget: 'string', i18n: true }];

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

/**
 * Render the pane.
 * @param {any} pane Pane state.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<{ draft: any, container: HTMLElement, props: any, thisPane: any }>} Draft,
 * container, props and pane state.
 */
const renderPane = async (pane, draftProps = {}) => {
  const draft = createMockDraft({
    fields,
    i18n,
    values: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    draft: draftProps,
  });

  const thisPane = createRawState(pane);

  const props = $state({
    id: 'pane-1-body',
    thisPane,
    thisPaneContentArea: /** @type {HTMLElement | undefined} */ (undefined),
    thatPaneContentArea: /** @type {HTMLElement | undefined} */ (undefined),
  });

  const { container } = await renderWithDraft(PaneBody, { draft, props });

  return { draft, container, props, thisPane };
};

/**
 * Create a scrollable element standing in for the other pane’s content area.
 * @returns {HTMLElement} Element.
 */
const createThatPane = () => {
  const element = document.createElement('div');

  element.style.cssText =
    'height: 100px; overflow: auto; position: relative; scroll-behavior: auto;';
  element.innerHTML =
    '<div style="height: 200px"></div>' +
    '<div data-key-path="title" style="height: 100px"></div>' +
    '<div style="height: 500px"></div>';
  document.body.append(element);

  return element;
};

/**
 * Scroll the given content area with the wheel, and wait for the next frame.
 * @param {HTMLElement} area Content area.
 * @param {number} [scrollTop] Position to scroll to first.
 * @returns {Promise<void>}
 */
const wheel = async (area, scrollTop) => {
  if (scrollTop !== undefined) {
    area.scrollTop = scrollTop;
  }

  area.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => setTimeout(resolve, 20));
  });
};

describe('PaneBody', () => {
  beforeAll(async () => {
    // Enabling a locale looks the collection up in the site configuration
    await initTestConfig({
      i18n: {
        structure: /** @type {const} */ ('multiple_folders'),
        locales: ['en', 'fr'],
        default_locale: 'en',
      },
      collections: [{ name: 'posts', label: 'Posts', folder: 'content/posts', i18n: true, fields }],
    });
  });

  afterEach(() => {
    customPreviewStyleRegistry.clear();
  });

  test('shows the editor for the locale', async () => {
    const { container } = await renderPane({ mode: 'edit', locale: 'fr' });

    expect(container.querySelector('#pane-1-body')).not.toBeNull();
    await expect.element(page.getByRole('group').getByRole('textbox')).toHaveValue('Bonjour');
  });

  test('shows the preview for the locale', async () => {
    await renderPane({ mode: 'preview', locale: 'en' });

    await expect
      .element(page.getByRole('document', { name: 'Content Preview' }))
      .toHaveTextContent('Title Hello');
  });

  test('offers to reenable a disabled locale', async () => {
    const { draft } = await renderPane(
      { mode: 'edit', locale: 'fr' },
      { currentLocales: { en: true, fr: false } },
    );

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'The \u2068French\u2069 content is now disabled. It will be deleted when you save the entry.',
      );

    await page.getByRole('button', { name: 'Reenable \u2068French\u2069' }).click();
    expect(draft.currentLocales.fr).toBe(true);
    await expect.element(page.getByRole('textbox')).toHaveValue('Bonjour');
  });

  test('offers to enable a locale that has no content', async () => {
    const { draft } = await renderPane(
      { mode: 'edit', locale: 'fr' },
      { currentLocales: { en: true, fr: false }, currentValues: { en: { title: 'Hello' } } },
    );

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('The \u2068French\u2069 content has been disabled.');

    await page.getByRole('button', { name: 'Enable \u2068French\u2069' }).click();
    expect(draft.currentLocales.fr).toBe(true);
    expect(draft.currentValues.fr).toBeDefined();
  });

  test('renders nothing for a disabled locale in the preview mode', async () => {
    // The settings may not be loaded yet
    entryEditorSettings.current = undefined;

    const { container } = await renderPane(
      { mode: 'preview', locale: 'fr' },
      { currentLocales: { en: true, fr: false } },
    );

    expect(container.querySelector('#pane-1-body')?.children).toHaveLength(0);
  });

  test('syncs the scroll position with the other pane', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      props.thatPaneContentArea = thatPane;
      // Make the pane scrollable
      area.style.height = '100px';
      area.insertAdjacentHTML('beforeend', '<div style="height: 1000px"></div>');

      // The top of the pane shows the Title field, so the other pane scrolls to its own Title field
      await wheel(area, 0);
      expect(thatPane.scrollTop).toBeCloseTo(200 - area.getBoundingClientRect().y, 0);

      // The top of the pane shows no field, so the other pane scrolls proportionally
      await wheel(area, area.scrollHeight);
      expect(thatPane.scrollTop).toBe(thatPane.scrollHeight - thatPane.clientHeight);

      // The other pane doesn’t have the field
      thatPane.querySelector('[data-key-path]')?.removeAttribute('data-key-path');
      thatPane.scrollTop = 50;
      await wheel(area, 0);
      expect(thatPane.scrollTop).toBe(50);

      // Syncing can be turned off, and is off until the settings are loaded
      entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: false };
      await wheel(area, area.scrollHeight);
      expect(thatPane.scrollTop).toBe(50);
      entryEditorSettings.current = undefined;
      await wheel(area, 0);
      expect(thatPane.scrollTop).toBe(50);
    } finally {
      thatPane.remove();
    }
  });

  test('listens to the preview iframe when a custom stylesheet is used', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };
    customPreviewStyleRegistry.add('https://example.com/preview.css');

    const thatPane = createThatPane();
    const { props, thisPane } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const editorArea = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      // Switching to the preview mode replaces the listened element with the iframe’s
      thisPane.current = { mode: 'preview', locale: 'en' };
      await expect.poll(() => props.thisPaneContentArea?.ownerDocument !== document).toBe(true);

      // The frame loads its content in the meantime, replacing its initial document
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      expect(area).not.toBe(editorArea);
      props.thatPaneContentArea = thatPane;
      thatPane.scrollTop = 50;
      await wheel(area);
      // The preview is scrolled to the top, so the other pane is too
      await expect.poll(() => thatPane.scrollTop).toBe(0);

      // Switching the mode back and forth quickly discards the outdated initialization
      thisPane.current = { mode: 'edit', locale: 'en' };
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      thisPane.current = { mode: 'preview', locale: 'en' };
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      thisPane.current = { mode: 'edit', locale: 'en' };
      await expect.poll(() => props.thisPaneContentArea).toBe(editorArea);
      await new Promise((resolve) => {
        setTimeout(resolve, 400);
      });
      expect(props.thisPaneContentArea).toBe(editorArea);
    } finally {
      thatPane.remove();
    }
  });
});
