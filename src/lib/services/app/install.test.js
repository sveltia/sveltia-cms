// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { initAppInstallDetection, installPrompt, promptAppInstall } from './install';

/**
 * Create a `beforeinstallprompt` event.
 * @returns {Event & { prompt: import('vitest').Mock }} Event.
 */
const createInstallPromptEvent = () =>
  Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
  });

describe('app install service', () => {
  /** @type {() => void} */
  let stop;

  beforeEach(() => {
    installPrompt.current = null;
    stop = initAppInstallDetection();
  });

  afterEach(() => {
    stop();
  });

  test('keeps the install prompt offered by the browser, and stops its own UI', () => {
    const event = createInstallPromptEvent();

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(installPrompt.current).toBe(event);
  });

  test('drops the install prompt once the app is installed', () => {
    window.dispatchEvent(createInstallPromptEvent());
    window.dispatchEvent(new Event('appinstalled'));

    expect(installPrompt.current).toBeNull();
  });

  test('stops listening once stopped', () => {
    stop();
    window.dispatchEvent(createInstallPromptEvent());

    expect(installPrompt.current).toBeNull();
  });

  test('shows the install prompt only once', async () => {
    const event = createInstallPromptEvent();

    window.dispatchEvent(event);
    await promptAppInstall();

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(installPrompt.current).toBeNull();

    await promptAppInstall();

    expect(event.prompt).toHaveBeenCalledOnce();
  });
});
