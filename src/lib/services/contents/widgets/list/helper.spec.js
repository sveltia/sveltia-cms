import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { formatSummary } from '$lib/services/contents/widgets/list/helper';

describe('Test formatSummary() — multiple fields', () => {
  const valueMap = {
    'images.0.src': 'hello.jpg',
    'images.0.alt': 'hello',
    'images.0.featured': true,
    'images.0.date': '2024-01-01',
  };

  const baseArgs = {
    collectionName: 'posts',
    keyPath: 'images',
    locale: 'en',
    hasSingleSubField: false,
    index: 0,
  };

  vi.mock('$lib/services/config', () => ({
    siteConfig: writable({
      backend: { name: 'github' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          fields: [
            {
              name: 'images',
              widget: 'list',
              fields: [
                { name: 'title', widget: 'string' },
                { name: 'src', widget: 'image' },
                { name: 'alt', widget: 'string' },
                { name: 'featured', widget: 'boolean' },
                { name: 'date', widget: 'date', picker_utc: true, time_format: false },
              ],
            },
          ],
        },
      ],
    }),
  }));

  test('without template', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': '', ...valueMap },
      }),
    ).toEqual('hello.jpg');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': 'Hello World', ...valueMap },
      }),
    ).toEqual('Hello World');
  });

  test('with template', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': '', ...valueMap },
        summaryTemplate: '{{fields.alt}}',
      }),
    ).toEqual('hello');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': 'Hello World', ...valueMap },
        summaryTemplate: '{{fields.alt}}',
      }),
    ).toEqual('hello');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': 'Hello World', ...valueMap },
        summaryTemplate: '{{fields.src}}',
      }),
    ).toEqual('hello.jpg');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0.title': 'Hello World', ...valueMap },
        summaryTemplate: '{{fields.name}}',
      }),
    ).toEqual('');
  });

  test('with template + transformations', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap,
        summaryTemplate: '{{fields.alt | upper}}',
      }),
    ).toEqual('HELLO');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap,
        summaryTemplate: '{{fields.alt | upper | truncate(2)}}',
      }),
    ).toEqual('HE…');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap,
        summaryTemplate: "{{fields.featured | ternary('featured','')}}",
      }),
    ).toEqual('featured');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap,
        summaryTemplate: "{{fields.date | date('MMM YYYY')}}",
      }),
    ).toEqual('Jan 2024');
  });
});

describe('Test formatSummary() — single field', () => {
  const baseArgs = {
    collectionName: 'posts',
    keyPath: 'images',
    locale: 'en',
    hasSingleSubField: true,
    index: 0,
  };

  vi.mock('$lib/services/config', () => ({
    siteConfig: writable({
      backend: { name: 'github' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          fields: [
            {
              name: 'images',
              widget: 'list',
              field: { name: 'src', widget: 'image' },
            },
          ],
        },
      ],
    }),
  }));

  test('without template', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0': 'hello.jpg' },
      }),
    ).toEqual('hello.jpg');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0': '' },
      }),
    ).toEqual('');
  });

  test('with template', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0': 'hello.jpg' },
        summaryTemplate: '{{fields.src}}',
      }),
    ).toEqual('hello.jpg');
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0': 'hello.jpg' },
        summaryTemplate: '{{fields.alt}}',
      }),
    ).toEqual('');
  });

  test('with template + transformations', () => {
    expect(
      formatSummary({
        ...baseArgs,
        valueMap: { 'images.0': 'hello.jpg' },
        summaryTemplate: '{{fields.src | upper | truncate(5)}}',
      }),
    ).toEqual('HELLO…');
  });
});
