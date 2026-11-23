// @vitest-environment happy-dom

import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createUsedEntriesState } from './used-entries.svelte.js';

/**
 * @import { Entry } from '$lib/types/private';
 */

const ENTRY_A = /** @type {Entry} */ (/** @type {unknown} */ ({ id: 'a' }));
const ENTRY_B = /** @type {Entry} */ (/** @type {unknown} */ ({ id: 'b' }));

/**
 * Wait for the pending promises to settle.
 */
const settle = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('createUsedEntriesState()', () => {
  /** @type {{ current: string | undefined }} */
  const props = $state({ current: undefined });
  /**
   * Function tearing down the effect root.
   * @type {() => void}
   */
  let cleanup = () => {};

  /**
   * Create the state, in an effect root standing in for a component.
   * @param {(file: string) => Promise<Entry[]>} find Function finding the entries using a file.
   * @param {(entries: Entry[]) => void} [onFound] Callback.
   * @returns {{ readonly entries: Entry[] | undefined }} State.
   */
  const create = (find, onFound) => {
    /** @type {{ readonly entries: Entry[] | undefined }} */
    let state = { entries: undefined };

    cleanup = $effect.root(() => {
      state = createUsedEntriesState(
        () => (props.current ? find(props.current) : undefined),
        onFound,
      );
    });
    flushSync();

    return state;
  };

  afterEach(() => {
    cleanup();
    props.current = undefined;
  });

  test('finds the entries using the files, and calls back once found', async () => {
    const find = vi.fn(async () => [ENTRY_A]);
    const onFound = vi.fn();

    props.current = 'a.png';

    const state = create(find, onFound);

    expect(state.entries).toBeUndefined();
    await settle();
    expect(state.entries).toEqual([ENTRY_A]);
    expect(find).toHaveBeenCalledWith('a.png');
    expect(onFound).toHaveBeenCalledWith([ENTRY_A]);
  });

  test('lets go of the entries while the files change, and ignores a stale lookup', async () => {
    /**
     * Function resolving the lookup for `a.png`.
     * @type {(entries: Entry[]) => void}
     */
    let resolveA = () => {};

    const find = vi.fn((/** @type {string} */ file) =>
      file === 'a.png'
        ? new Promise((resolve) => {
            resolveA = resolve;
          })
        : Promise.resolve([ENTRY_B]),
    );

    props.current = 'a.png';

    const state = create(/** @type {any} */ (find));

    props.current = 'b.png';
    flushSync();
    await settle();
    expect(state.entries).toEqual([ENTRY_B]);

    // The lookup for the file picked earlier comes back late, and is dropped
    resolveA([ENTRY_A]);
    await settle();
    expect(state.entries).toEqual([ENTRY_B]);

    // Without files there is nothing to look up
    props.current = undefined;
    flushSync();
    expect(state.entries).toBeUndefined();
  });
});
