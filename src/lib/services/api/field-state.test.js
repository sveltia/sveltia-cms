import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { fieldStateContext } from '$lib/services/api/field-state';

/**
 * @import { FieldState } from '$lib/services/api/field-state';
 */

/**
 * Render a consumer of the field state context and return the state it received.
 * @param {FieldState} [providerValue] Value passed to a provider around the consumer, if any.
 * @returns {any} Field state seen by the consumer.
 */
const readFieldState = (providerValue) => {
  /** @type {any} */
  let state;

  /**
   * Record the field state the consumer receives.
   * @param {FieldState} value Field state.
   * @returns {null} Nothing to render.
   */
  const children = (value) => {
    state = value;

    return null;
  };

  const consumer = createElement(fieldStateContext.Consumer, { children });

  renderToStaticMarkup(
    providerValue
      ? createElement(fieldStateContext.Provider, { value: providerValue }, consumer)
      : consumer,
  );

  return state;
};

describe('fieldStateContext', () => {
  test('defaults to an empty field state outside a provider', () => {
    expect(readFieldState()).toEqual({});
  });

  test('passes the provided field state down to a consumer', () => {
    const value = { locale: 'en', keyPath: 'title', required: true, readonly: false };

    expect(readFieldState(value)).toBe(value);
  });
});
