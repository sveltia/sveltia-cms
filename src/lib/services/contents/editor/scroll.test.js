import { describe, expect, test } from 'vitest';

import {
  getFieldAlignedScrollTop,
  getProportionalScrollTop,
} from '$lib/services/contents/editor/scroll';

describe('getProportionalScrollTop()', () => {
  test('scrolls the other pane in proportion', () => {
    expect(
      getProportionalScrollTop({
        scrollTop: 250,
        scrollHeight: 1500,
        clientHeight: 500,
        targetScrollHeight: 2000,
      }),
    ).toBe(500);
    expect(
      getProportionalScrollTop({
        scrollTop: 0,
        scrollHeight: 1500,
        clientHeight: 500,
        targetScrollHeight: 2000,
      }),
    ).toBe(0);
  });
});

describe('getFieldAlignedScrollTop()', () => {
  test('aligns the matching field at the same relative position', () => {
    // The top of the content area is a quarter of the way through the field
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 50,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(600);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 100,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(500);
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -100,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBe(900);
  });

  test('gives up when the top of the content area is outside the field', () => {
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: 150,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBeUndefined();
    expect(
      getFieldAlignedScrollTop({
        y: 100,
        top: -150,
        height: 200,
        targetOffsetTop: 600,
        targetHeight: 400,
      }),
    ).toBeUndefined();
  });
});
