import { beforeEach, describe, expect, it, vi } from 'vitest';

/** @import { EntryValidityState } from '$lib/types/private'; */

import {
  awaitCustomFieldValidations,
  registerCustomFieldInstance,
  resetCustomFieldValidation,
  triggerCustomFieldValidation,
  unregisterCustomFieldInstance,
  validateCustomField,
} from './custom-fields';

/** @type {any} */
const fieldConfig = { widget: 'custom', name: 'title' };

describe('draft/validate/custom-fields', () => {
  beforeEach(() => {
    resetCustomFieldValidation();
  });

  it('registers a custom widget instance and applies a valid result', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue(true) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.field', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.field',
      value: 'ok',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.field', validity });

    expect(instance.isValid).toHaveBeenCalledWith('ok', expect.anything());
    expect(validity).toEqual({ customError: false });
  });

  it('marks a field as invalid when the widget returns false', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue(false) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.error', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.error',
      value: 'invalid',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.error', validity });

    expect(validity).toEqual({ customError: true });
  });

  it('uses a string validation message from the widget result', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue({ error: 'Please fix this' }) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.error', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.error',
      value: 'invalid',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.error', validity });

    expect(validity).toEqual({ customError: true, customErrorMessage: 'Please fix this' });
  });

  it('uses the documented object validation message format', async () => {
    const instance = {
      isValid: vi.fn().mockResolvedValue({ error: { message: 'Nested message' } }),
    };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.error', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.error',
      value: 'invalid',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.error', validity });

    expect(validity).toEqual({ customError: true, customErrorMessage: 'Nested message' });
  });

  it('treats `{ error: false }` as valid', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue({ error: false }) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.field', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.field',
      value: 'ok',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.field', validity });

    expect(validity).toEqual({ customError: false });
  });

  it('surfaces the message when the widget throws an Error instance', async () => {
    const instance = { isValid: vi.fn().mockRejectedValue(new Error('Boom')) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.throw', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.throw',
      value: 'bad',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.throw', validity });

    expect(validity).toEqual({ customError: true, customErrorMessage: 'Boom' });
  });

  it('falls back to a default message when the widget throws a non-error value', async () => {
    const instance = { isValid: vi.fn().mockRejectedValue('Boom') };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.throw', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.throw',
      value: 'bad',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.throw', validity });

    expect(validity).toEqual({
      customError: true,
      customErrorMessage: 'validation.unexpected_error',
    });
  });

  it('treats unsupported return shapes as valid', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue({ foo: 'bar' }) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.reuse', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.reuse',
      value: 'value',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.reuse', validity });

    expect(validity).toEqual({ customError: false });
  });

  it('passes the field config to the validator as an Immutable Map', async () => {
    const instance = { isValid: vi.fn().mockResolvedValue(true) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.field', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.field',
      value: 'value',
      fieldConfig,
    });

    expect(instance.isValid.mock.calls[0][1].get('widget')).toBe('custom');
    expect(instance.isValid.mock.calls[0][1].get('name')).toBe('title');
  });

  it('ignores non-object registrations', async () => {
    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.invalid', instance: null });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.invalid',
      value: 'value',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.invalid', validity });

    expect(validity).toEqual({});
  });

  it('does nothing when a validator has not produced a cached result', () => {
    const instance = { isValid: vi.fn() };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.empty-cache', instance });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.empty-cache', validity });

    expect(validity).toEqual({});
  });

  it('treats a widget without a validator as valid', async () => {
    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.missing',
      value: 'nothing',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.missing', validity });

    expect(validity).toEqual({});
  });

  it('clears stale validation state when a widget is unregistered and re-registered', async () => {
    const firstInstance = { isValid: vi.fn().mockResolvedValue({ error: 'Stale message' }) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.reuse', instance: firstInstance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.reuse',
      value: 'old',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const firstValidity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.reuse', validity: firstValidity });

    expect(firstValidity.customErrorMessage).toBe('Stale message');

    unregisterCustomFieldInstance({ locale: 'en', keyPath: 'test.reuse' });

    const secondInstance = { isValid: vi.fn().mockResolvedValue(true) };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.reuse', instance: secondInstance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.reuse',
      value: 'new',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const secondValidity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.reuse', validity: secondValidity });

    expect(secondValidity).toEqual({ customError: false });
  });

  it('clears a previous error message once the field becomes valid', async () => {
    const instance = {
      isValid: vi.fn().mockResolvedValueOnce({ error: 'Too short' }).mockResolvedValueOnce(true),
    };

    registerCustomFieldInstance({ locale: 'en', keyPath: 'test.field', instance });

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.field',
      value: 'a',
      fieldConfig,
    });

    /** @type {EntryValidityState} */
    const validity = {};

    validateCustomField({ locale: 'en', keyPath: 'test.field', validity });

    expect(validity.customErrorMessage).toBe('Too short');

    await triggerCustomFieldValidation({
      locale: 'en',
      keyPath: 'test.field',
      value: 'abcdef',
      fieldConfig,
    });

    validateCustomField({ locale: 'en', keyPath: 'test.field', validity });

    // A leftover message would make the field look invalid via the validity proxy
    expect(validity).toEqual({ customError: false });
  });

  describe('locale isolation', () => {
    it('keeps validation results separate per locale', async () => {
      const enInstance = { isValid: vi.fn().mockResolvedValue(true) };
      const jaInstance = { isValid: vi.fn().mockResolvedValue({ error: 'Japanese is invalid' }) };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'title', instance: enInstance });
      registerCustomFieldInstance({ locale: 'ja', keyPath: 'title', instance: jaInstance });

      await triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'title',
        value: 'ok',
        fieldConfig,
      });
      await triggerCustomFieldValidation({
        locale: 'ja',
        keyPath: 'title',
        value: 'bad',
        fieldConfig,
      });

      /** @type {EntryValidityState} */
      const enValidity = {};
      /** @type {EntryValidityState} */
      const jaValidity = {};

      validateCustomField({ locale: 'en', keyPath: 'title', validity: enValidity });
      validateCustomField({ locale: 'ja', keyPath: 'title', validity: jaValidity });

      expect(enValidity).toEqual({ customError: false });
      expect(jaValidity).toEqual({
        customError: true,
        customErrorMessage: 'Japanese is invalid',
      });
    });

    it('does not unregister another locale’s instance', async () => {
      const enInstance = { isValid: vi.fn().mockResolvedValue({ error: 'English is invalid' }) };
      const jaInstance = { isValid: vi.fn().mockResolvedValue(true) };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'title', instance: enInstance });
      registerCustomFieldInstance({ locale: 'ja', keyPath: 'title', instance: jaInstance });

      await triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'title',
        value: 'bad',
        fieldConfig,
      });

      unregisterCustomFieldInstance({ locale: 'ja', keyPath: 'title' });

      /** @type {EntryValidityState} */
      const enValidity = {};

      validateCustomField({ locale: 'en', keyPath: 'title', validity: enValidity });

      expect(enValidity).toEqual({ customError: true, customErrorMessage: 'English is invalid' });
    });
  });

  describe('stale result handling', () => {
    it('discards a slow result superseded by a newer validation', async () => {
      /** @type {((value: any) => void)[]} */
      const resolvers = [];

      const instance = {
        isValid: vi.fn(
          () =>
            new Promise((resolve) => {
              resolvers.push(resolve);
            }),
        ),
      };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'test.race', instance });

      // Start a slow validation for the old value, then a second one for the current value
      const first = triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'test.race',
        value: 'old',
        fieldConfig,
      });

      const second = triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'test.race',
        value: 'new',
        fieldConfig,
      });

      // Resolve out of order: the newer call settles first, the stale one afterwards
      resolvers[1]({ error: 'New value is invalid' });
      resolvers[0](true);

      await Promise.all([first, second]);

      /** @type {EntryValidityState} */
      const validity = {};

      validateCustomField({ locale: 'en', keyPath: 'test.race', validity });

      // The stale `true` must not overwrite the verdict for the current value
      expect(validity).toEqual({
        customError: true,
        customErrorMessage: 'New value is invalid',
      });
    });

    it('discards a result that resolves after the field is unregistered', async () => {
      /** @type {any} */
      let resolve;

      const instance = {
        isValid: vi.fn(
          () =>
            new Promise((_resolve) => {
              resolve = _resolve;
            }),
        ),
      };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'test.late', instance });

      const promise = triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'test.late',
        value: 'value',
        fieldConfig,
      });

      unregisterCustomFieldInstance({ locale: 'en', keyPath: 'test.late' });
      resolve({ error: 'Too late' });
      await promise;

      // Re-register so `validateCustomField()` reaches the cache lookup
      registerCustomFieldInstance({ locale: 'en', keyPath: 'test.late', instance });

      /** @type {EntryValidityState} */
      const validity = {};

      validateCustomField({ locale: 'en', keyPath: 'test.late', validity });

      expect(validity).toEqual({});
    });
  });

  describe('awaitCustomFieldValidations', () => {
    it('resolves immediately when nothing is pending', async () => {
      await expect(awaitCustomFieldValidations()).resolves.toBeUndefined();
    });

    it('waits for an in-flight validation before returning', async () => {
      /** @type {any} */
      let resolve;

      const instance = {
        isValid: vi.fn(
          () =>
            new Promise((_resolve) => {
              resolve = _resolve;
            }),
        ),
      };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'test.pending', instance });

      const trigger = triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'test.pending',
        value: 'value',
        fieldConfig,
      });

      let settled = false;

      const waiter = awaitCustomFieldValidations().then(() => {
        settled = true;
      });

      // The validation is still in flight, so the waiter must not have settled yet
      await Promise.resolve();
      expect(settled).toBe(false);

      resolve({ error: 'Invalid after all' });
      await Promise.all([trigger, waiter]);

      expect(settled).toBe(true);

      /** @type {EntryValidityState} */
      const validity = {};

      validateCustomField({ locale: 'en', keyPath: 'test.pending', validity });

      expect(validity).toEqual({
        customError: true,
        customErrorMessage: 'Invalid after all',
      });
    });
  });

  describe('resetCustomFieldValidation', () => {
    it('discards instances and cached results', async () => {
      const instance = { isValid: vi.fn().mockResolvedValue({ error: 'From previous draft' }) };

      registerCustomFieldInstance({ locale: 'en', keyPath: 'title', instance });

      await triggerCustomFieldValidation({
        locale: 'en',
        keyPath: 'title',
        value: 'bad',
        fieldConfig,
      });

      resetCustomFieldValidation();

      // Re-register so `validateCustomField()` reaches the cache lookup
      registerCustomFieldInstance({ locale: 'en', keyPath: 'title', instance });

      /** @type {EntryValidityState} */
      const validity = {};

      validateCustomField({ locale: 'en', keyPath: 'title', validity });

      expect(validity).toEqual({});
    });
  });
});
