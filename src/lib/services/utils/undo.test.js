import { describe, expect, test, vi } from 'vitest';

import { runWithUndo } from './undo.js';

/**
 * Create a step whose result is the given value.
 * @param {string} value Result.
 * @returns {{ run: import('vitest').Mock, undo: import('vitest').Mock }} Step.
 */
const createStep = (value) => ({ run: vi.fn(async () => value), undo: vi.fn(async () => {}) });

describe('runWithUndo()', () => {
  test('runs the steps one at a time, then finishes with their results', async () => {
    const order = /** @type {string[]} */ ([]);

    const steps = ['a', 'b'].map((value) => ({
      run: vi.fn(async () => {
        order.push(value);

        return value;
      }),
      undo: vi.fn(),
    }));

    const finish = vi.fn(async () => {
      order.push('finish');
    });

    await expect(runWithUndo(steps, finish)).resolves.toEqual(['a', 'b']);
    expect(order).toEqual(['a', 'b', 'finish']);
    expect(finish).toHaveBeenCalledWith(['a', 'b']);
    expect(steps[0].undo).not.toHaveBeenCalled();
  });

  test('undoes the steps run so far when a step fails', async () => {
    const a = createStep('a');
    const b = { run: vi.fn().mockRejectedValue(new Error('Step failed')), undo: vi.fn() };
    const c = createStep('c');
    const finish = vi.fn();

    await expect(runWithUndo([a, b, c], finish)).rejects.toThrow('Step failed');
    expect(a.undo).toHaveBeenCalledWith('a');
    expect(b.undo).not.toHaveBeenCalled();
    expect(c.run).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  test('undoes every step when the finish fails, going on past one that can’t be undone', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = createStep('a');
    const b = createStep('b');

    a.undo.mockRejectedValue(new Error('Gone'));

    await expect(
      runWithUndo([a, b], async () => {
        throw new Error('Save failed');
      }),
    ).rejects.toThrow('Save failed');
    expect(a.undo).toHaveBeenCalledWith('a');
    expect(b.undo).toHaveBeenCalledWith('b');
    expect(error).toHaveBeenCalledWith(new Error('Gone'));
    error.mockRestore();
  });
});
