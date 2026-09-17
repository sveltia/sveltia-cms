import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDebugLogger } from './logging';

describe('createDebugLogger', () => {
  /** @type {import('vitest').MockInstance} */
  let consoleDebug;
  /** @type {import('vitest').MockInstance} */
  let now;

  beforeEach(() => {
    consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    now = vi.spyOn(performance, 'now');
  });

  afterEach(() => {
    consoleDebug.mockRestore();
    now.mockRestore();
  });

  it('should prefix the scope and append the step and total times', () => {
    now.mockReturnValueOnce(1000);

    const log = createDebugLogger('Loading');

    now.mockReturnValueOnce(1250.4);
    log('First step');
    now.mockReturnValueOnce(2100);
    log('Second step');

    expect(consoleDebug).toHaveBeenCalledTimes(2);
    expect(consoleDebug).toHaveBeenNthCalledWith(1, '[Loading] First step (+250 ms, 250 ms total)');
    expect(consoleDebug).toHaveBeenNthCalledWith(
      2,
      '[Loading] Second step (+850 ms, 1100 ms total)',
    );
  });

  it('should pass any extra details through to the console', () => {
    now.mockReturnValue(0);

    const log = createDebugLogger('Loading');
    const details = { count: 3 };

    log('Step', details, 'more');

    expect(consoleDebug).toHaveBeenCalledWith(
      '[Loading] Step (+0 ms, 0 ms total)',
      details,
      'more',
    );
  });
});
