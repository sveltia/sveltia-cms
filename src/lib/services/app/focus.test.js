// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keepFocusIn, rememberFocus } from './focus';

describe('rememberFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('gives the focus back to the element that opened the overlay', () => {
    document.body.innerHTML = '<button id="opener"></button><button id="other"></button>';

    const opener = /** @type {HTMLElement} */ (document.querySelector('#opener'));

    opener.focus();

    const restoreFocus = rememberFocus();

    /** @type {HTMLElement} */ (document.querySelector('#other')).focus();
    restoreFocus();
    expect(document.activeElement).toBe(opener);
  });

  it('falls back to the page container when the opener is gone', () => {
    document.body.innerHTML =
      '<div id="page-container"><button id="opener"></button></div><button id="other"></button>';

    const opener = /** @type {HTMLElement} */ (document.querySelector('#opener'));

    opener.focus();

    const restoreFocus = rememberFocus();

    opener.remove();
    /** @type {HTMLElement} */ (document.querySelector('#other')).focus();
    restoreFocus();

    const container = /** @type {HTMLElement} */ (document.querySelector('#page-container'));

    expect(container.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(container);
  });

  it('falls back to the page container when nothing had the focus', () => {
    document.body.innerHTML = '<div id="page-container"></div>';

    const restoreFocus = rememberFocus();

    restoreFocus();
    expect(document.activeElement).toBe(document.querySelector('#page-container'));
  });

  it('skips an opener that has become inert', () => {
    document.body.innerHTML = '<div><button id="opener"></button></div>';

    const opener = /** @type {HTMLElement} */ (document.querySelector('#opener'));

    opener.focus();

    const restoreFocus = rememberFocus();

    /** @type {HTMLElement} */ (opener.parentElement).setAttribute('inert', '');
    opener.blur();
    restoreFocus();
    // Nothing else to focus on this page either
    expect(document.activeElement).toBe(document.body);
  });
});

describe('keepFocusIn', () => {
  /** @type {HTMLElement} */
  let container;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] });
    document.body.innerHTML =
      '<div id="pane"><div id="folders" role="listbox" tabindex="0"></div></div>' +
      '<button id="outside"></button>';
    container = /** @type {HTMLElement} */ (document.querySelector('#pane'));
    /** @type {HTMLElement} */ (document.querySelector('#folders')).focus();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  /**
   * Replace the content of the container, which takes the focus away with the old content.
   * @param {string} html New content.
   */
  const replaceContent = (html) => {
    container.innerHTML = html;
    // happy-dom doesn’t move the focus off a removed element the way a browser does
    /** @type {HTMLElement} */ (document.activeElement).blur();
  };

  it('leaves the focus alone while it stays within the new content', () => {
    keepFocusIn(container);
    vi.advanceTimersToNextFrame();
    expect(document.activeElement?.id).toBe('folders');
  });

  it('moves the focus to a list box in the new content', () => {
    keepFocusIn(container);
    replaceContent('<div id="files" role="listbox" tabindex="0"></div>');
    vi.advanceTimersToNextFrame();
    expect(document.activeElement?.id).toBe('files');
  });

  it('focuses the container until a list box shows up', () => {
    keepFocusIn(container);
    replaceContent('<span role="alert">Loading…</span>');
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(container);
    expect(container.tabIndex).toBe(-1);

    container.insertAdjacentHTML('beforeend', '<div id="files" role="listbox" tabindex="0"></div>');
    vi.advanceTimersToNextFrame();
    expect(document.activeElement?.id).toBe('files');
  });

  it('stops watching once the user has moved the focus elsewhere', () => {
    keepFocusIn(container);
    replaceContent('');
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(container);

    /** @type {HTMLElement} */ (document.querySelector('#outside')).focus();
    container.innerHTML = '<div id="files" role="listbox" tabindex="0"></div>';
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(document.activeElement?.id).toBe('outside');
  });

  it('stops watching after the timeout', () => {
    keepFocusIn(container, { timeout: 100 });
    replaceContent('');
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(container);

    // A list box showing up later is left alone
    container.innerHTML = '<div id="files" role="listbox" tabindex="0"></div>';
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(container);
  });

  it('doesn’t focus a container that has been removed', () => {
    keepFocusIn(container, { timeout: 100 });
    container.remove();
    /** @type {HTMLElement} */ (document.activeElement).blur();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);
  });
});
