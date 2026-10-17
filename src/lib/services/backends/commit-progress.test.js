import { beforeEach, describe, expect, test } from 'vitest';

import {
  advancePreparing,
  clearSaveProgress,
  reportCommits,
  saveProgress,
  startPreparing,
} from '$lib/services/backends/commit-progress';

describe('commit progress', () => {
  beforeEach(() => {
    clearSaveProgress();
  });

  test('starts empty', () => {
    expect(saveProgress.current).toBeUndefined();
  });

  test('counts the files prepared, never past the total', () => {
    startPreparing(2);
    expect(saveProgress.current).toEqual({
      phase: 'preparing',
      done: 0,
      total: 2,
      approximate: false,
    });

    advancePreparing();
    advancePreparing();
    advancePreparing();
    expect(saveProgress.current?.done).toBe(2);
  });

  test('reports nothing for a single file', () => {
    startPreparing(1);
    expect(saveProgress.current).toBeUndefined();
    advancePreparing();
    expect(saveProgress.current).toBeUndefined();
  });

  test('ignores a prepared file while committing', () => {
    reportCommits(1, 3);
    advancePreparing();
    expect(saveProgress.current).toMatchObject({ phase: 'committing', done: 1 });
  });

  test('reports the commits made out of an estimated total', () => {
    reportCommits(12, 26);
    expect(saveProgress.current).toEqual({
      phase: 'committing',
      done: 12,
      total: 26,
      approximate: true,
    });
  });

  test('raises a low estimate to the number of commits made', () => {
    reportCommits(5, 3);
    expect(saveProgress.current?.total).toBe(5);
  });

  test('reports nothing for a single commit', () => {
    reportCommits(0, 1);
    expect(saveProgress.current).toBeUndefined();
  });

  test('clears the progress', () => {
    reportCommits(1, 3);
    clearSaveProgress();
    expect(saveProgress.current).toBeUndefined();
  });
});
