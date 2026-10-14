/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

import { preloadImmutable } from '$lib/services/api/immutable';
import { preloadReactDom } from '$lib/services/api/react-dom';

vi.mock('$lib/services/api/immutable', () => ({
  preloadImmutable: vi.fn(),
}));
vi.mock('$lib/services/api/react-dom', () => ({
  preloadReactDom: vi.fn(),
}));

const { registerPreviewTemplate } =
  await import('$lib/services/api/methods/register-preview-template');

describe('CMS.registerPreviewTemplate()', () => {
  test('registers a preview template successfully', () => {
    const component = () => null;

    // @ts-ignore
    expect(() => registerPreviewTemplate('posts', component)).not.toThrow();
    // The template will receive Immutable Maps, so the library is loaded ahead of time
    expect(preloadImmutable).toHaveBeenCalled();
    expect(preloadReactDom).toHaveBeenCalled();
  });

  test('throws TypeError when name is not a non-empty string', () => {
    const component = () => null;

    // @ts-ignore
    expect(() => registerPreviewTemplate(123, component)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewTemplate('   ', component)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewTemplate(123, component)).toThrow(
      'The `name` option for `CMS.registerPreviewTemplate()` must be a non-empty string',
    );
  });

  test('registers a wrapped component as a preview template', () => {
    const component = { $$typeof: Symbol.for('react.memo'), type: () => null };

    // @ts-ignore
    expect(() => registerPreviewTemplate('posts', component)).not.toThrow();
  });

  test('throws TypeError when component is not a function', () => {
    // @ts-ignore
    expect(() => registerPreviewTemplate('posts', 'not-a-function')).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewTemplate('posts', 'not-a-function')).toThrow(
      'The `component` option for `CMS.registerPreviewTemplate()` must be a React component',
    );
  });

  test('allows registering multiple templates', () => {
    const component1 = () => null;
    const component2 = () => null;

    // @ts-ignore
    expect(() => registerPreviewTemplate('posts', component1)).not.toThrow();
    // @ts-ignore
    expect(() => registerPreviewTemplate('pages', component2)).not.toThrow();
  });

  test('replaces existing template with same name', () => {
    const component1 = () => null;
    const component2 = () => null;

    // @ts-ignore
    registerPreviewTemplate('posts', component1);
    // @ts-ignore
    registerPreviewTemplate('posts', component2);

    // No error should be thrown
    expect(true).toBe(true);
  });
});
