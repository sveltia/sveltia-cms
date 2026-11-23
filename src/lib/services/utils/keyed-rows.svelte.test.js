// @vitest-environment happy-dom

import { flushSync } from 'svelte';
import { describe, expect, test } from 'vitest';

import { createKeyedRows } from './keyed-rows.svelte.js';

describe('createKeyedRows', () => {
  test('gives each initial row an identifier', () => {
    const rows = createKeyedRows(['a', 'b']);

    expect(rows.values).toEqual(['a', 'b']);
    expect(rows.ids).toEqual([0, 1]);
  });

  test('starts with no rows by default', () => {
    const rows = createKeyedRows();

    expect(rows.values).toEqual([]);
    expect(rows.ids).toEqual([]);
  });

  test('inserts a row with a new identifier', () => {
    const rows = createKeyedRows(['a', 'b']);

    rows.insert(1, 'x');
    rows.insert(3, 'y');

    expect(rows.values).toEqual(['a', 'x', 'b', 'y']);
    expect(rows.ids).toEqual([0, 2, 1, 3]);
  });

  test('removes a row with its identifier', () => {
    const rows = createKeyedRows(['a', 'b', 'c']);

    rows.remove(1);

    expect(rows.values).toEqual(['a', 'c']);
    expect(rows.ids).toEqual([0, 2]);

    // A removed identifier is never reused
    rows.insert(2, 'd');

    expect(rows.ids).toEqual([0, 2, 3]);
  });

  test('moves a row with its identifier', () => {
    const rows = createKeyedRows(['a', 'b', 'c']);

    rows.move(2, 0);

    expect(rows.values).toEqual(['c', 'a', 'b']);
    expect(rows.ids).toEqual([2, 0, 1]);
  });

  test('replaces the rows, giving each a new identifier', () => {
    const rows = createKeyedRows(['a', 'b']);

    rows.replace(['a', 'x', 'y']);

    expect(rows.values).toEqual(['a', 'x', 'y']);
    expect(rows.ids).toEqual([2, 3, 4]);
  });

  test('replaces the rows, keeping the identifiers by position', () => {
    const rows = createKeyedRows(['a', 'b']);

    rows.replace(['x', 'y', 'z'], { keepIds: true });

    expect(rows.values).toEqual(['x', 'y', 'z']);
    expect(rows.ids).toEqual([0, 1, 2]);

    rows.replace(['x'], { keepIds: true });

    expect(rows.values).toEqual(['x']);
    expect(rows.ids).toEqual([0]);
  });

  test('makes the rows deeply reactive', () => {
    const rows = createKeyedRows([['a', '1']]);
    /** @type {string[][][]} */
    const snapshots = [];

    const cleanup = $effect.root(() => {
      $effect(() => {
        snapshots.push($state.snapshot(rows.values));
      });
    });

    flushSync();
    rows.values[0][1] = '2';
    flushSync();
    rows.replace([['b', '3']]);
    flushSync();
    rows.values[0][0] = 'c';
    flushSync();
    cleanup();

    expect(snapshots).toEqual([[['a', '1']], [['a', '2']], [['b', '3']], [['c', '3']]]);
  });
});
