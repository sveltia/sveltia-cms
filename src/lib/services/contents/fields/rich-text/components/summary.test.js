import { describe, expect, test, vi } from 'vitest';

import { formatComponentSummary } from '$lib/services/contents/fields/rich-text/components/summary';

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
