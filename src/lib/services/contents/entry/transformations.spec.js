import { describe, expect, test } from 'vitest';
import { applyTransformation } from '$lib/services/contents/entry/transformations';

describe('Test applyTransformation()', () => {
  test('upper/lower', () => {
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: 'upper',
      }),
    ).toBe('HELLO');
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: 'lower',
      }),
    ).toBe('hello');
  });

  test('default', () => {
    expect(
      applyTransformation({
        value: '',
        transformation: "default('Undefined')",
      }),
    ).toBe('Undefined');
    expect(
      applyTransformation({
        value: 'Description',
        transformation: "default('Undefined')",
      }),
    ).toBe('Description');
  });

  test('ternary', () => {
    expect(
      applyTransformation({
        value: true,
        transformation: "ternary('Published', 'Draft')",
      }),
    ).toBe('Published');
    expect(
      applyTransformation({
        value: false,
        transformation: "ternary('Published', 'Draft')",
      }),
    ).toBe('Draft');
  });

  test('truncate', () => {
    const title =
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(
      applyTransformation({
        value: title,
        transformation: 'truncate(40)',
      }),
    ).toBe(
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur…',
    );
    expect(
      applyTransformation({
        value: title,
        transformation: "truncate(50, '***')",
      }),
    ).toBe(
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur adipiscing***',
    );
    expect(
      applyTransformation({
        value: title,
        transformation: 'truncate(-10)',
      }),
    ).toBe(title);
  });

  test('date', () => {
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: "date('LL')",
      }),
    ).toBe('January 23, 2024');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45',
        transformation: "date('LLL')",
      }),
    ).toBe('January 23, 2024 1:23 AM');
    // @todo Fix the test that depends on the computer’s time zone. We could use `moment-timezone`
    // but will soon migrate to Day.js
    // expect(
    //   applyTransformation({
    //     value: '2024-01-23T01:23:45-05:00',
    //     transformation: "date('YYYY-MM-DD-HH-mm')",
    //   }),
    // ).toBe('2024-01-23-01-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45-05:00',
        transformation: "date('YYYY-MM-DD-HH-mm', 'utc')",
      }),
    ).toBe('2024-01-23-06-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45Z',
        transformation: "date('YYYY-MM-DD-HH-mm')",
        fieldConfig: { name: 'date', widget: 'datetime', picker_utc: true },
      }),
    ).toBe('2024-01-23-01-23');
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: "date('LLL')",
        fieldConfig: { name: 'date', widget: 'datetime', time_format: false },
      }),
    ).toBe('January 23, 2024 12:00 AM');
  });
});
