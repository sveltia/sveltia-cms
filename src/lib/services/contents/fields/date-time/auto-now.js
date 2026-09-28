import { getField } from '$lib/services/contents/entry/fields';
import { getCurrentStorableValue } from '$lib/services/contents/fields/date-time/helpers';
import { getOrCreate } from '$lib/services/utils/cache';
import { isValueEmpty } from '$lib/services/utils/object';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { DateTimeAutoNowStage, DateTimeField, Field } from '$lib/types/public';
 */

/**
 * Get the stages at which a DateTime field is set to the current date/time.
 * @param {Field} fieldConfig Field configuration.
 * @returns {DateTimeAutoNowStage[]} Stages. Empty if the field isn’t a DateTime field or the
 * `auto_now` option is not enabled.
 */
export const getAutoNowStages = (fieldConfig) => {
  if (fieldConfig.widget !== 'datetime') {
    return [];
  }

  const { auto_now: autoNow = false } = /** @type {DateTimeField} */ (fieldConfig);

  if (typeof autoNow === 'boolean') {
    return autoNow ? ['create', 'update'] : [];
  }

  // A value of another type is reported against the JSON schema
  return Array.isArray(autoNow) ? autoNow : [];
};

/**
 * Check whether a field is a DateTime field whose value is set automatically on save. Such a field
 * is read-only and isn’t validated.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} Result.
 */
export const isAutoNowField = (fieldConfig) => getAutoNowStages(fieldConfig).length > 0;

/**
 * Check whether a DateTime field with the `auto_now` option is to be set when the draft is saved.
 * `create` covers a new entry and a value that hasn’t been set yet, such as one in a List item
 * added to an existing entry, or one in an entry saved before the option was enabled. `update`
 * covers every save of an existing entry.
 * @param {object} args Arguments.
 * @param {DateTimeAutoNowStage[]} args.stages Stages enabled for the field.
 * @param {boolean} args.isNew Whether the draft is for a new entry.
 * @param {any} args.value Current value of the field.
 * @returns {boolean} Result.
 */
const isAutoNowDue = ({ stages, isNew, value }) =>
  (stages.includes('create') && (isNew || isValueEmpty(value))) ||
  (stages.includes('update') && !isNew);

/**
 * Set the DateTime fields with the `auto_now` option to the current date/time in the draft’s
 * current values, if the option covers the stage being saved. The value isn’t localized, so every
 * locale gets the same one. A field in a rich text editor component isn’t covered, because its
 * value is stored in the Markdown rather than in the draft’s values; the option is ignored there.
 * @param {EntryDraft} draft Draft to mutate in place.
 */
export const assignAutoNowValues = (draft) => {
  const { isNew, collectionName, fileName, isIndexFile, currentValues } = draft;
  // Take the time once, so every field, locale and list item saved together gets the same one
  const date = new Date();
  /**
   * Values keyed by field configuration, so a field shared by locales and list items is only
   * formatted once.
   * @type {Map<Field, string>}
   */
  const valueCache = new Map();

  Object.values(currentValues).forEach((valueMap) => {
    Object.entries(valueMap).forEach(([keyPath, value]) => {
      const fieldConfig = getField({ collectionName, fileName, keyPath, valueMap, isIndexFile });

      if (fieldConfig && isAutoNowDue({ stages: getAutoNowStages(fieldConfig), isNew, value })) {
        valueMap[keyPath] = getOrCreate(valueCache, fieldConfig, () =>
          getCurrentStorableValue(/** @type {DateTimeField} */ (fieldConfig), {
            date,
            includeSeconds: true,
          }),
        );
      }
    });
  });
};
