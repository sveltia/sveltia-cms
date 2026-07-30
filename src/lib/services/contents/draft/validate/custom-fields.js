import { _ } from '@sveltia/i18n';

import { getFieldConfigMap } from '$lib/services/contents/fields/custom/helpers';

/**
 * @import { EntryValidityState, InternalLocaleCode } from '$lib/types/private';
 * @import { CustomField, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Registry of custom field component instances keyed by locale and field key path. These instances
 * may have an `isValid()` method for custom validation.
 * @type {Map<string, any>}
 */
const customFieldInstances = new Map();
/**
 * Cache of validation results keyed by locale and field key path. `pending` is `true` while an
 * async `isValid()` call is in flight, so that a save attempt can wait for the final verdict.
 * @type {Map<string, { valid: boolean, message?: string, pending: boolean }>}
 */
const validationCache = new Map();
/**
 * In-flight validation promises keyed by locale and field key path, used to await pending results
 * before saving.
 * @type {Map<string, Promise<void>>}
 */
const pendingValidations = new Map();
/**
 * Monotonically increasing sequence number per locale and field key path, used to discard results
 * from stale `isValid()` calls that resolve out of order.
 * @type {Map<string, number>}
 */
const validationSequences = new Map();
/**
 * Get the internal cache key for a custom field instance.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {FieldKeyPath} keyPath Field key path.
 * @returns {string} Cache key.
 */
const getCacheKey = (locale, keyPath) => `${locale}:${keyPath}`;

/**
 * Register a custom field component instance for validation.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {any} args.instance Custom field component instance (may have an `isValid()` method).
 */
export const registerCustomFieldInstance = ({ locale, keyPath, instance }) => {
  if (instance && typeof instance === 'object') {
    customFieldInstances.set(getCacheKey(locale, keyPath), instance);
  }
};

/**
 * Unregister a custom field instance and discard any cached or in-flight validation state.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 */
export const unregisterCustomFieldInstance = ({ locale, keyPath }) => {
  const cacheKey = getCacheKey(locale, keyPath);

  customFieldInstances.delete(cacheKey);
  validationCache.delete(cacheKey);
  pendingValidations.delete(cacheKey);
  // Bump the sequence so any in-flight validation resolving after teardown is discarded instead of
  // repopulating the cache for a field that no longer exists
  validationSequences.set(cacheKey, (validationSequences.get(cacheKey) ?? 0) + 1);
};

/**
 * Discard all custom field validation state. Called when an entry draft is created so that results
 * never leak between drafts.
 */
export const resetCustomFieldValidation = () => {
  customFieldInstances.clear();
  validationCache.clear();
  pendingValidations.clear();
  validationSequences.clear();
};

/**
 * Parse the result returned by a widget’s `isValid()` method.
 * @param {any} result Return value of `isValid()`.
 * @returns {{ valid: boolean, message?: string }} Normalized result.
 */
const parseValidationResult = (result) => {
  // Handle Netlify/Decap CMS validation result formats:
  // - Boolean: `true` (valid) or `false` (invalid)
  // - Object: `{ error: { message: 'text' } }` (invalid with nested message, per docs)
  if (result === false) {
    return { valid: false };
  }

  if (typeof result === 'object' && result !== null) {
    const { error } = result;

    // Documentation format: `{ error: { message: 'text' } }`
    if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
      return { valid: false, message: error.message };
    }
  }

  // Any other shape, including `true` and `{ error: false }`, is treated as valid
  return { valid: true };
};

/**
 * Trigger async validation for a custom field. The result is cached so that the synchronous
 * validation pass can pick it up, and the returned promise is tracked so that a save attempt can
 * await the final verdict.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {any} args.value Field value.
 * @param {CustomField} args.fieldConfig Field configuration.
 * @returns {Promise<void>} Promise that resolves when validation is complete.
 */
export const triggerCustomFieldValidation = async ({ locale, keyPath, value, fieldConfig }) => {
  const cacheKey = getCacheKey(locale, keyPath);
  const instance = customFieldInstances.get(cacheKey);

  if (typeof instance?.isValid !== 'function') {
    validationCache.set(cacheKey, { valid: true, pending: false });

    return;
  }

  const sequence = (validationSequences.get(cacheKey) ?? 0) + 1;

  validationSequences.set(cacheKey, sequence);

  // Preserve the previous verdict while revalidating, but mark it as pending so that a save attempt
  // waits for the fresh result instead of trusting a stale one
  const previous = validationCache.get(cacheKey);

  validationCache.set(cacheKey, {
    valid: previous?.valid ?? true,
    message: previous?.message,
    pending: true,
  });

  const promise = (async () => {
    const field = getFieldConfigMap(fieldConfig);
    /** @type {{ valid: boolean, message?: string }} */
    let outcome;

    try {
      outcome = parseValidationResult(await instance.isValid(value, field));
    } catch (error) {
      // If `isValid()` throws, treat the field as invalid. Widgets are trusted first-party code, so
      // the message is surfaced as-is, but it’s always rendered as plain text, never as HTML.
      outcome = {
        valid: false,
        message: error instanceof Error ? error.message : _('validation.unexpected_error'),
      };
    }

    // Discard the result if a newer validation started, or the field was unregistered, while this
    // one was in flight
    if (validationSequences.get(cacheKey) !== sequence) {
      return;
    }

    validationCache.set(cacheKey, { ...outcome, pending: false });
  })();

  pendingValidations.set(cacheKey, promise);

  try {
    await promise;
  } finally {
    if (pendingValidations.get(cacheKey) === promise) {
      pendingValidations.delete(cacheKey);
    }
  }
};

/**
 * Wait for all in-flight custom field validations to settle. Call this before validating an entry
 * for saving, so that the verdicts read by {@link validateCustomField} reflect the current values.
 * @returns {Promise<void>} Promise that resolves once no validation is pending.
 */
export const awaitCustomFieldValidations = async () => {
  // A validator may trigger further validation, so drain until no promises remain
  while (pendingValidations.size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(pendingValidations.values());
  }
};

/**
 * Validate a custom field using the cached validation result. This is called synchronously during
 * the validation pass.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {EntryValidityState} args.validity Validity state to update.
 */
export const validateCustomField = ({ locale, keyPath, validity }) => {
  const cacheKey = getCacheKey(locale, keyPath);
  const instance = customFieldInstances.get(cacheKey);

  // Only validate if there’s a validator registered
  if (typeof instance?.isValid !== 'function') {
    return;
  }

  const cached = validationCache.get(cacheKey);

  if (!cached) {
    return;
  }

  validity.customError = !cached.valid;

  if (!cached.valid && cached.message) {
    validity.customErrorMessage = cached.message;
  } else {
    // `customErrorMessage` is a non-boolean property, so a leftover value would make the field look
    // invalid via the validity proxy. Always clear it unless there’s a current message.
    delete validity.customErrorMessage;
  }
};
