/* eslint-disable jsdoc/require-jsdoc */

import { createElement, forwardRef, lazy, memo } from 'react';
import { describe, expect, test } from 'vitest';

import { isReactComponent } from './react';

describe('isReactComponent()', () => {
  test('accepts function and class components', () => {
    expect(isReactComponent(() => null)).toBe(true);
    expect(isReactComponent(class {})).toBe(true);
  });

  test('accepts wrapped components', () => {
    expect(isReactComponent(forwardRef(() => null))).toBe(true);
    expect(isReactComponent(memo(() => null))).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isReactComponent(createElement('div'))).toBe(false);
    expect(isReactComponent(lazy(async () => ({ default: () => null })))).toBe(false);
    expect(isReactComponent({})).toBe(false);
    expect(isReactComponent('div')).toBe(false);
    expect(isReactComponent(null)).toBe(false);
    expect(isReactComponent(undefined)).toBe(false);
  });
});
