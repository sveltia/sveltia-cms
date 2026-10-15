import { tick } from 'svelte';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { immutableLoaded } from '$lib/services/api/immutable';
import {
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
} from '$lib/services/api/registries';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { createRawState } from '$lib/services/utils/state.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PaneBody from './pane-body.svelte';

// A preview template is only rendered once Immutable.js has loaded, which these tests hold back, so
// the template’s iframe doesn’t appear until a test sets `immutableLoaded`. A stylesheet’s iframe
// doesn’t depend on it
vi.mock('$lib/services/api/immutable', async (importOriginal) => {
  const { createRawState: createState } = await import('$lib/services/utils/state.svelte');
  const immutable = await vi.importActual('immutable');

  return {
    ...(await importOriginal()),
    immutableLoaded: createState(false),
    loadImmutable: vi.fn(() => new Promise(() => {})),
    /**
     * Get the library, which the tests import rather than load from the CDN.
     * @returns {any} Module.
     */
    getImmutable: () => immutable,
  };
});

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
 * Scroll the given content area, and wait for the next frame. The scroll event is fired even if
 * the position doesn’t change, so a test can scroll to where the area already is.
 * @param {HTMLElement} area Content area.
 * @param {object} [options] Options.
 * @param {number} [options.scrollTop] Position to scroll to.
 * @param {Event} [options.event] User event preceding the scroll, which makes the area the one
 * the user is scrolling. Default: a `wheel` event.
 * @returns {Promise<void>}
 */
const scroll = async (
  area,
  { scrollTop, event = new WheelEvent('wheel', { bubbles: true }) } = {},
) => {
  area.dispatchEvent(event);

  if (scrollTop !== undefined) {
    area.scrollTop = scrollTop;
  }

  // The root element of the preview iframe’s document gets no scroll events; its document does
  (area === area.ownerDocument.documentElement ? area.ownerDocument : area).dispatchEvent(
    new Event('scroll'),
  );
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => setTimeout(resolve, 20));
  });
};

/**
 * Scroll the given content area with the wheel, and wait for the next frame.
 * @param {HTMLElement} area Content area.
 * @param {number} [scrollTop] Position to scroll to.
 * @returns {Promise<void>}
 */
const wheel = (area, scrollTop) => scroll(area, { scrollTop });

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
    customPreviewTemplateRegistry.clear();
    immutableLoaded.current = false;
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

  test('syncs the position the pane has been scrolled to, after a touch', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      props.thatPaneContentArea = thatPane;
      area.style.height = '100px';
      area.insertAdjacentHTML('beforeend', '<div style="height: 1000px"></div>');

      // The wheel event comes before the pane is scrolled, and the sync waits for the scroll, so
      // the other pane gets the new position rather than the one before it
      await scroll(area, {
        scrollTop: area.scrollHeight,
        event: new TouchEvent('touchstart', { bubbles: true }),
      });
      expect(thatPane.scrollTop).toBe(thatPane.scrollHeight - thatPane.clientHeight);
    } finally {
      thatPane.remove();
    }
  });

  test('ignores the scrolling of a pane the user isn’t scrolling', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      props.thatPaneContentArea = thatPane;
      area.style.height = '100px';
      area.insertAdjacentHTML('beforeend', '<div style="height: 1000px"></div>');

      // A pane scrolled by the sync of the other pane doesn’t sync it back
      thatPane.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
      await scroll(area, { scrollTop: area.scrollHeight, event: new Event('focus') });
      expect(thatPane.scrollTop).toBe(0);
    } finally {
      thatPane.remove();
    }
  });

  test('scrolls the other pane to the focused field', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const { props, thisPane } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);
      const input = page.getByRole('textbox', { name: 'Title' });

      props.thatPaneContentArea = thatPane;

      // The Title field is below the visible area of the other pane, so it’s brought to the middle
      await input.click();
      await expect.poll(() => thatPane.scrollTop).toBe(200);

      // Already visible, if not in the middle
      input.element().blur();
      /** @type {HTMLElement} */ (thatPane.children[1]).style.height = '50px';
      thatPane.scrollTo({ top: 190, behavior: 'instant' });
      await input.click();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(thatPane.scrollTop).toBe(190);

      // Focusing something that isn’t a field does nothing
      input.element().blur();
      thatPane.scrollTo({ top: 0, behavior: 'instant' });
      area.insertAdjacentHTML('beforeend', '<button type="button">Other</button>');
      /** @type {HTMLElement} */ (area.querySelector('button:last-child')).focus();

      // Syncing can be turned off
      entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: false };
      await input.click();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(thatPane.scrollTop).toBe(0);
      input.element().blur();
      entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

      // A field the other pane doesn’t show
      thatPane.querySelector('[data-key-path]')?.removeAttribute('data-key-path');
      await input.click();
      input.element().blur();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(thatPane.scrollTop).toBe(0);

      // A field removed before the other pane is scrolled. It’s removed on focus, as a click on a
      // loaded runner may only resolve after the frames the pane waits for
      thatPane.children[1].setAttribute('data-key-path', 'title');
      area.addEventListener(
        'focusin',
        () => {
          area.querySelector('[data-key-path="title"]')?.remove();
        },
        { once: true },
      );
      input.element().focus();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(thatPane.scrollTop).toBe(0);

      // A preview pane doesn’t scroll the other pane, even if a field preview looks like a field
      thisPane.current = { mode: 'preview', locale: 'en' };
      await expect.poll(() => area.querySelector('[role="document"]')).not.toBeNull();
      area.insertAdjacentHTML(
        'beforeend',
        '<div class="field" data-key-path="title" tabindex="-1"></div>',
      );
      /** @type {HTMLElement} */ (area.querySelector('.field[data-key-path="title"]')).focus();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(thatPane.scrollTop).toBe(0);
    } finally {
      thatPane.remove();
      entryEditorSettings.current = undefined;
    }
  });

  test('scrolls the other pane to a focused field it hasn’t rendered yet', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const [above, item] = /** @type {HTMLElement[]} */ ([...thatPane.children]);

    // A field only rendered once its placeholder is scrolled into view, along with the content
    // above it, which moves the field down
    item.removeAttribute('data-key-path');
    item.dataset.lazyKeyPath = 'title';
    item.innerHTML = '<div class="placeholder"></div>';
    thatPane.addEventListener(
      'scroll',
      () => {
        above.style.height = '400px';
        item.style.height = '';
        item.innerHTML = '<div data-key-path="title" style="height: 50px"></div>';
      },
      { once: true },
    );

    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();
      props.thatPaneContentArea = thatPane;
      await page.getByRole('textbox', { name: 'Title' }).click();
      // The rendered field is brought to the middle
      await expect.poll(() => thatPane.scrollTop).toBe(375);
    } finally {
      thatPane.remove();
      entryEditorSettings.current = undefined;
    }
  });

  test('stops scrolling the other pane to a focused field once the user scrolls', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const [above, item] = /** @type {HTMLElement[]} */ ([...thatPane.children]);

    // A field that never renders, while the content above it keeps growing, so the other pane would
    // keep being scrolled towards it
    item.removeAttribute('data-key-path');
    item.dataset.lazyKeyPath = 'title';
    item.innerHTML = '<div class="placeholder"></div>';
    thatPane.addEventListener('scroll', () => {
      above.style.height = `${above.offsetHeight + 100}px`;
    });

    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      props.thatPaneContentArea = thatPane;
      await page.getByRole('textbox', { name: 'Title' }).click();
      await expect.poll(() => thatPane.scrollTop).toBeGreaterThan(0);

      // The user scrolls, and the other pane is left where they take it
      area.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
      thatPane.scrollTo({ top: 0, behavior: 'instant' });
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });
      expect(thatPane.scrollTop).toBe(0);
    } finally {
      thatPane.remove();
      entryEditorSettings.current = undefined;
    }
  });

  test('puts the other pane back when the focused field turns out not to be shown', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const thatPane = createThatPane();
    const [, item] = /** @type {HTMLElement[]} */ ([...thatPane.children]);
    /** @type {number[]} */
    const positions = [];

    // A field whose wrapper is left empty once its placeholder is scrolled into view
    item.removeAttribute('data-key-path');
    item.dataset.lazyKeyPath = 'title';
    item.innerHTML = '<div class="placeholder"></div>';
    thatPane.addEventListener('scroll', () => {
      positions.push(thatPane.scrollTop);
      item.innerHTML = '<!---->';
    });

    const { props } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();
      props.thatPaneContentArea = thatPane;
      await page.getByRole('textbox', { name: 'Title' }).click();
      // Scrolled towards the placeholder, then back to the top
      await expect.poll(() => positions).toEqual([200, 0]);
    } finally {
      thatPane.remove();
      entryEditorSettings.current = undefined;
    }
  });

  test('scrolls the preview iframe to the focused field', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };

    const iframe = document.createElement('iframe');

    iframe.style.cssText = 'height: 100px; border: 0';
    iframe.srcdoc =
      '<body style="margin: 0"><div style="height: 200px"></div>' +
      '<div data-key-path="title" style="height: 100px"></div>' +
      '<div style="height: 500px"></div></body>';
    document.body.append(iframe);

    try {
      await new Promise((resolve) => {
        iframe.addEventListener('load', resolve, { once: true });
      });

      const thatPane = /** @type {HTMLElement} */ (iframe.contentDocument?.documentElement);
      const { props } = await renderPane({ mode: 'edit', locale: 'en' });

      await expect.poll(() => props.thisPaneContentArea).toBeDefined();
      props.thatPaneContentArea = thatPane;
      await page.getByRole('textbox', { name: 'Title' }).click();
      await expect.poll(() => thatPane.scrollTop).toBe(200);
    } finally {
      iframe.remove();
      entryEditorSettings.current = undefined;
    }
  });

  test('listens to the preview itself when the custom template is for another collection', async () => {
    customPreviewTemplateRegistry.set('pages', () => null);

    const { props } = await renderPane({ mode: 'preview', locale: 'en' });

    // The preview isn’t rendered in an iframe, so it’s listened to right away
    await tick();
    expect(props.thisPaneContentArea).toBeDefined();
    expect(props.thisPaneContentArea?.ownerDocument).toBe(document);
    expect(props.thisPaneContentArea?.querySelector('iframe')).toBeNull();
  });

  test('listens to the custom template’s iframe once it appears', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };
    customPreviewTemplateRegistry.set('posts', () => null);

    const thatPane = createThatPane();
    const { props } = await renderPane({ mode: 'preview', locale: 'en' });

    try {
      // The template isn’t rendered until Immutable.js has loaded, so the preview area is listened
      // to in the meantime
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const previewArea = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      expect(previewArea.ownerDocument).toBe(document);
      expect(previewArea.querySelector('iframe')).toBeNull();
      // Long after the iframe would have been looked for
      await new Promise((resolve) => {
        setTimeout(resolve, 600);
      });
      immutableLoaded.current = true;

      // The iframe’s document is listened to once the frame has loaded
      await expect.poll(() => props.thisPaneContentArea?.ownerDocument !== document).toBe(true);

      const iframe = /** @type {HTMLIFrameElement} */ (previewArea.querySelector('iframe.preview'));
      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      expect(area).toBe(iframe.contentDocument?.documentElement);
      props.thatPaneContentArea = thatPane;
      thatPane.scrollTop = 50;
      await wheel(area);
      // The preview is scrolled to the top, so the other pane is too
      await expect.poll(() => thatPane.scrollTop).toBe(0);

      // The preview area itself is no longer listened to
      thatPane.scrollTop = 50;
      await wheel(previewArea);
      expect(thatPane.scrollTop).toBe(50);
    } finally {
      thatPane.remove();
    }
  });

  test('listens to the custom template’s iframe replacing the stylesheet’s', async () => {
    customPreviewStyleRegistry.add({ url: 'https://example.com/preview.css' });
    customPreviewTemplateRegistry.set('posts', () => null);

    const { props } = await renderPane({ mode: 'preview', locale: 'en' });

    // The stylesheet’s iframe is rendered until Immutable.js has loaded for the template
    await expect.poll(() => props.thisPaneContentArea?.ownerDocument !== document).toBe(true);

    const styleFrameArea = props.thisPaneContentArea;

    immutableLoaded.current = true;
    await expect
      .poll(() => props.thisPaneContentArea !== styleFrameArea && props.thisPaneContentArea)
      .toBeTruthy();
    expect(props.thisPaneContentArea?.ownerDocument).not.toBe(document);
    expect(props.thisPaneContentArea?.isConnected).toBe(true);
  });

  test('listens to the preview iframe when a custom stylesheet is used', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };
    customPreviewStyleRegistry.add({ url: 'https://example.com/preview.css' });

    const thatPane = createThatPane();
    const { props, thisPane } = await renderPane({ mode: 'edit', locale: 'en' });

    try {
      await expect.poll(() => props.thisPaneContentArea).toBeDefined();

      const editorArea = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      // Switching to the preview mode replaces the listened element with the iframe’s, once the
      // frame has loaded its content
      thisPane.current = { mode: 'preview', locale: 'en' };
      await expect.poll(() => props.thisPaneContentArea?.ownerDocument !== document).toBe(true);

      const area = /** @type {HTMLElement} */ (props.thisPaneContentArea);

      expect(area).not.toBe(editorArea);
      expect(area.isConnected).toBe(true);
      props.thatPaneContentArea = thatPane;
      thatPane.scrollTop = 50;
      await wheel(area);
      // The preview is scrolled to the top, so the other pane is too
      await expect.poll(() => thatPane.scrollTop).toBe(0);

      // Switching back to the edit mode before the frame has loaded leaves the editor listened to
      thisPane.current = { mode: 'edit', locale: 'en' };
      await expect.poll(() => props.thisPaneContentArea).toBe(editorArea);
      thisPane.current = { mode: 'preview', locale: 'en' };
      await tick();
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

  test('listens to the preview itself once the iframe has navigated away', async () => {
    entryEditorSettings.current = { ...entryEditorSettings.current, syncScrolling: true };
    customPreviewStyleRegistry.add({ url: 'https://example.com/preview.css' });

    const { props, thisPane } = await renderPane({ mode: 'preview', locale: 'en' });

    await expect.poll(() => props.thisPaneContentArea?.ownerDocument !== document).toBe(true);

    const iframe = /** @type {HTMLIFrameElement} */ (document.querySelector('iframe.preview'));

    // A link followed in the preview loads a page from another origin, whose document is out of
    // reach
    Object.defineProperty(iframe, 'contentDocument', { value: null, configurable: true });
    // Resizing the panes, for example, sets the pane again without changing its mode
    thisPane.current = { mode: 'preview', locale: 'en' };

    await expect
      .poll(() => props.thisPaneContentArea)
      .toBe(iframe.closest('.content') ?? undefined);
  });
});
