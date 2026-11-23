// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  canSwipeOn,
  getArrowKeyDirection,
  getSwipeDirection,
  SWIPE_MIN_DISTANCE,
} from './overlay-navigation';

describe('getArrowKeyDirection()', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLButtonElement} */
  let button;

  beforeEach(() => {
    container = document.createElement('div');
    button = document.createElement('button');
    container.append(button);
    document.body.append(container);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  /**
   * Create a `keydown` event dispatched on the given target.
   * @param {EventTarget} target Event target.
   * @param {KeyboardEventInit} init Event options.
   * @returns {KeyboardEvent} Event.
   */
  const createEvent = (target, init) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, ...init });

    Object.defineProperty(event, 'target', { value: target });

    return event;
  };

  test('moves with the arrow keys within the overlay', () => {
    const options = { container, rtl: false };

    expect(getArrowKeyDirection(createEvent(button, { key: 'ArrowLeft' }), options)).toBe(
      'previous',
    );
    expect(getArrowKeyDirection(createEvent(button, { key: 'ArrowRight' }), options)).toBe('next');
  });

  test('swaps the keys in a right-to-left locale', () => {
    const options = { container, rtl: true };

    expect(getArrowKeyDirection(createEvent(button, { key: 'ArrowLeft' }), options)).toBe('next');
    expect(getArrowKeyDirection(createEvent(button, { key: 'ArrowRight' }), options)).toBe(
      'previous',
    );
  });

  test('moves with the focus on the body', () => {
    expect(
      getArrowKeyDirection(createEvent(document.body, { key: 'ArrowRight' }), {
        container: undefined,
        rtl: false,
      }),
    ).toBe('next');
  });

  test('ignores other keys and modified arrow keys', () => {
    const options = { container, rtl: false };

    expect(getArrowKeyDirection(createEvent(button, { key: 'ArrowUp' }), options)).toBeUndefined();

    ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'].forEach((modifier) => {
      expect(
        getArrowKeyDirection(createEvent(button, { key: 'ArrowLeft', [modifier]: true }), options),
      ).toBeUndefined();
    });
  });

  test('ignores a key pressed outside the overlay', () => {
    const outside = document.createElement('button');

    document.body.append(outside);

    expect(
      getArrowKeyDirection(createEvent(outside, { key: 'ArrowLeft' }), { container, rtl: false }),
    ).toBeUndefined();
    expect(
      getArrowKeyDirection(createEvent(button, { key: 'ArrowLeft' }), {
        container: undefined,
        rtl: false,
      }),
    ).toBeUndefined();
    expect(
      getArrowKeyDirection(createEvent(window, { key: 'ArrowLeft' }), { container, rtl: false }),
    ).toBeUndefined();
  });

  test('ignores a key pressed where the arrow keys mean something else', () => {
    const input = document.createElement('input');
    const listbox = document.createElement('div');
    const option = document.createElement('div');
    const editable = document.createElement('div');

    listbox.setAttribute('role', 'listbox');
    listbox.append(option);
    editable.contentEditable = 'true';
    container.append(input, listbox, editable);

    // happy-dom doesn’t derive `isContentEditable` from the attribute
    Object.defineProperty(editable, 'isContentEditable', { value: true });

    [input, option, editable].forEach((target) => {
      expect(
        getArrowKeyDirection(createEvent(target, { key: 'ArrowLeft' }), { container, rtl: false }),
      ).toBeUndefined();
    });
  });
});

describe('canSwipeOn()', () => {
  test('allows a swipe on most elements', () => {
    expect(canSwipeOn(document.createElement('img'))).toBe(true);
    expect(canSwipeOn(null)).toBe(true);
  });

  test('disallows a swipe on an element dragged sideways itself', () => {
    const video = document.createElement('video');
    const slider = document.createElement('div');
    const thumb = document.createElement('span');

    slider.setAttribute('role', 'slider');
    slider.append(thumb);

    expect(canSwipeOn(video)).toBe(false);
    expect(canSwipeOn(thumb)).toBe(false);
  });
});

describe('getSwipeDirection()', () => {
  const start = { x: 200, y: 200 };

  test('moves with a horizontal swipe', () => {
    expect(getSwipeDirection({ start, end: { x: 300, y: 220 }, rtl: false })).toBe('previous');
    expect(getSwipeDirection({ start, end: { x: 100, y: 180 }, rtl: false })).toBe('next');
  });

  test('swaps the directions in a right-to-left locale', () => {
    expect(getSwipeDirection({ start, end: { x: 300, y: 200 }, rtl: true })).toBe('next');
    expect(getSwipeDirection({ start, end: { x: 100, y: 200 }, rtl: true })).toBe('previous');
  });

  test('takes a swipe of the minimum distance', () => {
    expect(
      getSwipeDirection({ start, end: { x: start.x + SWIPE_MIN_DISTANCE, y: 200 }, rtl: false }),
    ).toBe('previous');
  });

  test('ignores a short or mostly vertical move', () => {
    expect(
      getSwipeDirection({
        start,
        end: { x: start.x + SWIPE_MIN_DISTANCE - 1, y: 200 },
        rtl: false,
      }),
    ).toBeUndefined();
    expect(getSwipeDirection({ start, end: { x: 300, y: 350 }, rtl: false })).toBeUndefined();
  });
});
