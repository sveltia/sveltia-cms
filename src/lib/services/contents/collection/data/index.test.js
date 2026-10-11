import { describe, expect, test } from 'vitest';

import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';

describe('UPDATE_TOAST_DEFAULT_STATE', () => {
  test('has every flag off and a count of one', () => {
    const { count, ...flags } = UPDATE_TOAST_DEFAULT_STATE;

    expect(count).toBe(1);
    expect(Object.keys(flags).length).toBeGreaterThan(0);
    Object.values(flags).forEach((value) => expect(value).toBe(false));
  });
});

describe('contentUpdatesToast', () => {
  test('starts out with the default state', () => {
    expect(contentUpdatesToast.current).toEqual(UPDATE_TOAST_DEFAULT_STATE);
  });

  test('holds a copy, so that an update does not change the default state', () => {
    try {
      contentUpdatesToast.current.saved = true;
      contentUpdatesToast.current.count = 3;

      expect(UPDATE_TOAST_DEFAULT_STATE.saved).toBe(false);
      expect(UPDATE_TOAST_DEFAULT_STATE.count).toBe(1);
    } finally {
      contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
    }
  });
});
