// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest';

import { waitForMediaLoad } from '$lib/services/utils/media/load';

describe('waitForMediaLoad()', () => {
  test('resolves with `true` once the given event fires', async () => {
    const element = document.createElement('video');
    const promise = waitForMediaLoad(element, 'loadedmetadata');

    element.dispatchEvent(new Event('loadedmetadata'));

    await expect(promise).resolves.toBe(true);
  });

  test('resolves with `false` once the media fails to load', async () => {
    const element = document.createElement('img');
    const promise = waitForMediaLoad(element, 'load');

    element.dispatchEvent(new Event('error'));

    await expect(promise).resolves.toBe(false);
  });
});
