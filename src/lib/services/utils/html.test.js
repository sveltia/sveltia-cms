// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest';

import {
  isInsideTag,
  parseHTMLFragment,
  parseStartTag,
  serializeStartTag,
} from '$lib/services/utils/html';

describe('isInsideTag()', () => {
  test('tells a tag in another tag’s attribute value from an element', () => {
    const value = '<a title=\'<img src="a.png">\'>x</a> a < b <img src="b.png">';

    expect(isInsideTag(value, value.indexOf('<img'))).toBe(true);
    expect(isInsideTag(value, value.lastIndexOf('<img'))).toBe(false);
    expect(isInsideTag('<img src="a.png">', 0)).toBe(false);
    expect(isInsideTag('text <', 6)).toBe(false);
  });
});

describe('parseHTMLFragment()', () => {
  test('parses the HTML into the content of a template', () => {
    const template = parseHTMLFragment('<p>a</p><img src="a.png">');

    expect(template.localName).toBe('template');
    expect(template.content.childElementCount).toBe(2);
  });
});

describe('parseStartTag() and serializeStartTag()', () => {
  test('round-trips the start tag of a void element', () => {
    const element = parseStartTag('<img src="a.png" alt=\'b\'>');

    expect(element.localName).toBe('img');
    expect(element.getAttribute('src')).toBe('a.png');
    expect(serializeStartTag(element)).toBe('<img src="a.png" alt="b">');
  });

  test('leaves out the end tag of an element with content', () => {
    const element = parseStartTag('<video src="a.mp4">');

    element.setAttribute('poster', 'a&b.jpg');

    expect(serializeStartTag(element)).toBe('<video src="a.mp4" poster="a&amp;b.jpg">');
  });
});
