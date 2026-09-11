import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { dataLoadedProgress } from '$lib/services/contents';

import { PROGRESS_CEILING, PROGRESS_TICK_INTERVAL, startSimulatedProgress } from './progress.js';

vi.mock('$lib/services/contents', () => ({ dataLoadedProgress: { current: undefined } }));

describe('startSimulatedProgress()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The helper schedules on `window`, which the Node environment doesn’t have
    vi.stubGlobal('window', { setInterval, clearInterval });
    dataLoadedProgress.current = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('starts at zero and advances at a fixed tick rate', () => {
    const stop = startSimulatedProgress(1000);

    expect(dataLoadedProgress.current).toBe(0);

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL - 1);
    expect(dataLoadedProgress.current).toBe(0);

    // 1000 files × 10 ms = 10 s budget, so one 100 ms tick is 1%
    vi.advanceTimersByTime(1);
    expect(dataLoadedProgress.current).toBe(1);

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL * 4);
    expect(dataLoadedProgress.current).toBe(5);

    stop();
  });

  test('takes bigger steps for a small repository, without racing ahead of the eye', () => {
    const stop = startSimulatedProgress(50);

    // 50 files × 10 ms = 500 ms budget, so one tick is 20%
    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL);
    expect(dataLoadedProgress.current).toBe(20);

    stop();
  });

  test('never exceeds the ceiling while the fetch is still running', () => {
    const stop = startSimulatedProgress(50);

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL * 20);
    expect(dataLoadedProgress.current).toBe(PROGRESS_CEILING);

    stop();
  });

  test('copes with an empty file list', () => {
    const stop = startSimulatedProgress(0);

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL);
    expect(dataLoadedProgress.current).toBe(PROGRESS_CEILING);

    stop();
  });

  test('stops ticking and hides the bar once stopped', () => {
    const stop = startSimulatedProgress(1000);

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL);
    stop();
    expect(dataLoadedProgress.current).toBeUndefined();

    vi.advanceTimersByTime(PROGRESS_TICK_INTERVAL * 5);
    expect(dataLoadedProgress.current).toBeUndefined();
  });
});
