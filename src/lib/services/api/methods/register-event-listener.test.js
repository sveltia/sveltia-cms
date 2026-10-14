/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import { preloadImmutable } from '$lib/services/api/immutable';

vi.mock('$lib/services/api/immutable', () => ({
  preloadImmutable: vi.fn(),
}));
vi.mock('$lib/services/api/events', () => ({
  SUPPORTED_EVENT_TYPES: [
    'preSave',
    'postSave',
    'prePublish',
    'postPublish',
    'preUnpublish',
    'postUnpublish',
  ],
}));

const { registerEventListener } = await import('$lib/services/api/methods/register-event-listener');

describe('CMS.registerEventListener()', () => {
  test('registers valid event listener', () => {
    // @ts-ignore
    const listener = {
      name: 'preSave',
      handler: () => {},
    };

    // @ts-ignore
    expect(() => registerEventListener(listener)).not.toThrow();
    // The handler will receive an Immutable Map, so the library is loaded ahead of time
    expect(preloadImmutable).toHaveBeenCalled();
  });

  test('registers all supported event types', () => {
    const eventTypes = [
      'preSave',
      'postSave',
      'prePublish',
      'postPublish',
      'preUnpublish',
      'postUnpublish',
    ];

    eventTypes.forEach((eventType) => {
      // @ts-ignore
      const listener = {
        name: eventType,
        handler: () => {},
      };

      // @ts-ignore
      expect(() => registerEventListener(listener)).not.toThrow();
    });
  });

  test('throws TypeError if listener is not an object', () => {
    // @ts-ignore
    expect(() => registerEventListener(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEventListener(undefined)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEventListener('invalid')).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerEventListener(123)).toThrow(TypeError);
  });

  test('throws with proper error message for non-object listener', () => {
    // @ts-ignore
    expect(() => registerEventListener(null)).toThrow('The event listener must be an object');
  });

  test('throws TypeError if name is not a string', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        // @ts-ignore
        name: 123,
        handler: () => {},
      }),
    ).toThrow(TypeError);

    // @ts-ignore
    expect(() =>
      registerEventListener({
        // @ts-ignore
        name: null,
        handler: () => {},
      }),
    ).toThrow(TypeError);
  });

  test('throws TypeError if handler is not a function', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: 'invalid',
      }),
    ).toThrow(TypeError);

    // @ts-ignore
    expect(() =>
      registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: {},
      }),
    ).toThrow(TypeError);
  });

  test('throws with proper error message for missing properties', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: 'invalid',
      }),
    ).toThrow(
      'The event listener must have a string `name` property and a function `handler` property',
    );
  });

  test('throws RangeError if event type is not supported', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        // @ts-ignore
        name: 'unsupportedEvent',
        handler: () => {},
      }),
    ).toThrow(RangeError);
  });

  test('throws with proper error message for unsupported event type', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        // @ts-ignore
        name: 'invalidEvent',
        handler: () => {},
      }),
    ).toThrow('Unsupported event listener name "invalidEvent"');
  });

  test('accepts async handler functions', () => {
    // @ts-ignore
    expect(() =>
      registerEventListener({
        name: 'preSave',
        // @ts-ignore
        handler: async () => {},
      }),
    ).not.toThrow();
  });
});
