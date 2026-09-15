// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { rememberFocus } from './focus';

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
