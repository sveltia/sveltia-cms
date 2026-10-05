// @vitest-environment happy-dom

/* eslint-disable jsdoc/require-jsdoc */

import { act, Fragment, isValidElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { html, parseStyle } from './htm';

describe('parseStyle()', () => {
  test('converts the property names to camel case', () => {
    expect(parseStyle('color: red; font-size: 2em; background-color: blue')).toEqual({
      color: 'red',
      fontSize: '2em',
      backgroundColor: 'blue',
    });
  });

  test('keeps the name of a custom property as is', () => {
    expect(parseStyle('--accent-color: red')).toEqual({ '--accent-color': 'red' });
  });

  test('keeps a shorthand as is, even with a custom property', () => {
    expect(parseStyle('padding: var(--gap); margin: 0 auto')).toEqual({
      padding: 'var(--gap)',
      margin: '0 auto',
    });
  });

  test('ignores a semicolon within parentheses or quotes', () => {
    expect(
      parseStyle(
        'background: url(data:image/png;base64,AAAA); font-family: "A;B", \'C;D\'; width: calc((1px + 2px) * 2)',
      ),
    ).toEqual({
      background: 'url(data:image/png;base64,AAAA)',
      fontFamily: '"A;B", \'C;D\'',
      width: 'calc((1px + 2px) * 2)',
    });
  });

  test('drops the `!important` priority, keeping the value', () => {
    expect(parseStyle('color: red !important; margin: 0 ! IMPORTANT')).toEqual({
      color: 'red',
      margin: '0',
    });
  });

  test('lowercases a property name', () => {
    expect(parseStyle('Font-Size: 2em')).toEqual({ fontSize: '2em' });
  });

  test('skips an incomplete declaration', () => {
    expect(parseStyle(';color; :red; width:; ; height: 1px;')).toEqual({ height: '1px' });
  });

  test('returns an empty object for an empty string', () => {
    expect(parseStyle('')).toEqual({});
  });
});

describe('html', () => {
  test('creates a React element', () => {
    const element = html`<p class="note" id=${'intro'}>Hello, ${'world'}!</p>`;

    expect(isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: 'p',
      props: { class: 'note', id: 'intro', children: ['Hello, ', 'world', '!'] },
    });
  });

  test('creates an element without props', () => {
    expect(html`<br />`).toMatchObject({ type: 'br', props: {} });
  });

  test('returns an array for multiple root elements', () => {
    const elements = html`<h1>Title</h1>
      <p>Text</p>`;

    expect(Array.isArray(elements)).toBe(true);
    expect(elements).toMatchObject([{ type: 'h1' }, { type: 'p' }]);
  });

  test('creates an element of a component', () => {
    const Badge = () => null;
    const element = html`<${Badge} label="New">Text<//>`;

    expect(element).toMatchObject({ type: Badge, props: { label: 'New', children: 'Text' } });
  });

  test('converts a string `style` prop to an object', () => {
    expect(html`<p style="color: red; font-size: 2em">Text</p>`).toMatchObject({
      props: { style: { color: 'red', fontSize: '2em' } },
    });
  });

  test('leaves a `style` object as is', () => {
    const style = { color: 'red' };

    expect(/** @type {any} */ (html`<p style=${style}>Text</p>`).props.style).toBe(style);
  });

  describe('rendering', () => {
    /** @type {HTMLElement} */
    let container;
    /** @type {import('react-dom/client').Root} */
    let root;

    beforeEach(() => {
      // @ts-ignore
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    test('renders HTML attributes, inline styles, fragments and hooks', () => {
      const Counter = ({ label = '' }) => {
        const [count, setCount] = useState(0);

        return html`
          <label for="count" style="color: red">${label}</label>
          <button id="count" class="counter" onClick=${() => setCount(count + 1)}>${count}</button>
        `;
      };

      act(() => root.render(html`<${Fragment}><${Counter} label="Clicks" /><//>`));

      const label = /** @type {HTMLLabelElement} */ (container.querySelector('label'));
      const button = /** @type {HTMLButtonElement} */ (container.querySelector('button.counter'));

      expect(label.htmlFor).toBe('count');
      expect(label.style.color).toBe('red');
      expect(button.textContent).toBe('0');

      act(() => button.click());

      expect(button.textContent).toBe('1');
    });
  });
});
