import { describe, expect, test, vi } from 'vitest';

import {
  formatComponentSummary,
  getComponentDisplayText,
  getComponentDisplayValues,
} from '$lib/services/contents/fields/rich-text/components/summary';

vi.mock('$lib/services/config');

/** @type {import('$lib/types/public').Field[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'date', widget: 'datetime' },
  { name: 'link', widget: 'object', fields: [{ name: 'url', widget: 'string' }] },
];

describe('formatComponentSummary()', () => {
  test('returns null without a template or values', () => {
    expect(formatComponentSummary({ values: { title: 'Hi' }, fields })).toBeNull();
    expect(formatComponentSummary({ template: '', values: { title: 'Hi' }, fields })).toBeNull();
    expect(formatComponentSummary({ template: '{{title}}', fields })).toBeNull();
  });

  test('returns a template without placeholders as is unless it’s blank', () => {
    expect(formatComponentSummary({ template: ' Icon ', fields })).toBe('Icon');
    expect(formatComponentSummary({ template: ' ', values: { title: 'Hi' }, fields })).toBeNull();
  });

  test('replaces placeholders with the values', () => {
    expect(
      formatComponentSummary({
        template: '{{title}} ({{link.url}})',
        values: { title: 'Hi', link: { url: 'https://x.y' } },
        fields,
      }),
    ).toBe('Hi (https://x.y)');
  });

  test('accepts the `fields.` prefix', () => {
    expect(
      formatComponentSummary({ template: '{{fields.title}}', values: { title: 'Hi' }, fields }),
    ).toBe('Hi');
  });

  test('applies transformations', () => {
    expect(
      formatComponentSummary({ template: '{{title | upper}}', values: { title: 'hi' }, fields }),
    ).toBe('HI');
    expect(
      formatComponentSummary({
        template: "{{date | date('YYYY', 'utc')}}",
        values: { date: '2026-09-12T00:00:00Z' },
        fields,
      }),
    ).toBe('2026');
  });

  test('treats missing values as empty', () => {
    expect(
      formatComponentSummary({
        template: '{{title}}!{{link.url}}',
        values: { title: 'Hi' },
        fields,
      }),
    ).toBe('Hi!');
  });

  test('returns null when every placeholder is empty and only literal text remains', () => {
    expect(
      formatComponentSummary({ template: '{{title}} — {{link.url}}', values: {}, fields }),
    ).toBeNull();
  });

  test('trims the result', () => {
    expect(
      formatComponentSummary({ template: '  {{title}}  ', values: { title: 'Hi' }, fields }),
    ).toBe('Hi');
  });

  test('returns null when the result is blank', () => {
    expect(
      formatComponentSummary({ template: '{{title}}', values: { title: '   ' }, fields }),
    ).toBeNull();
  });
});

describe('getComponentDisplayText()', () => {
  const args = { fields, label: 'Card' };

  test('prefers the formatted summary', () => {
    expect(
      getComponentDisplayText({
        ...args,
        template: 'Card: {{title}}',
        currentValues: { title: 'Hello' },
      }),
    ).toBe('Card: Hello');
  });

  test('falls back to the first string field', () => {
    expect(getComponentDisplayText({ ...args, currentValues: { title: '  Hello  ' } })).toBe(
      'Hello',
    );
    expect(
      getComponentDisplayText({
        fields: [{ name: 'body', widget: 'text' }],
        label: 'Card',
        currentValues: { body: 'Text' },
      }),
    ).toBe('Text');
    expect(
      getComponentDisplayText({
        fields: [{ name: 'body' }],
        label: 'Card',
        currentValues: { body: 'Text' },
      }),
    ).toBe('Text');
  });

  test('uses the values from the document until the draft has some', () => {
    expect(
      getComponentDisplayText({ ...args, currentValues: {}, values: { title: 'From Document' } }),
    ).toBe('From Document');
    expect(
      getComponentDisplayText({
        ...args,
        currentValues: { title: 'From Draft' },
        values: { title: 'From Document' },
      }),
    ).toBe('From Draft');
  });

  test('falls back to the label', () => {
    expect(getComponentDisplayText(args)).toBe('Card');
    expect(getComponentDisplayText({ ...args, currentValues: { title: '  ' } })).toBe('Card');
    expect(getComponentDisplayText({ ...args, currentValues: { title: 1 } })).toBe('Card');
    expect(
      getComponentDisplayText({
        fields: [{ name: 'date', widget: 'datetime' }],
        label: 'Card',
        currentValues: { date: '2026-01-01' },
      }),
    ).toBe('Card');
  });

  test('omits the label when a thumbnail is shown', () => {
    expect(getComponentDisplayText({ ...args, hasThumbnail: true })).toBe('');
    expect(
      getComponentDisplayText({ ...args, hasThumbnail: true, currentValues: { title: 'Hello' } }),
    ).toBe('Hello');
  });
});

describe('getComponentDisplayValues()', () => {
  test('prefers the values in the draft once it has some', () => {
    const values = { title: 'From Document' };

    expect(getComponentDisplayValues({ fields, values })).toBe(values);
    expect(getComponentDisplayValues({ fields, currentValues: {}, values })).toBe(values);

    const currentValues = { title: 'From Draft' };

    expect(getComponentDisplayValues({ fields, currentValues, values })).toBe(currentValues);
  });
});
