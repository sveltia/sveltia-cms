import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
import { getInheritedI18nOption } from '$lib/services/contents/i18n/shared-values';

/**
 * @import { EntryDraft, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * @typedef {object} FieldLocaleAccess
 * @property {boolean} canTranslate Whether the field has a value of its own in each locale.
 * @property {boolean} isDuplicated Whether the field’s value is copied from the default locale to
 * the given locale, which is another locale, so it’s shown read-only there.
 * @property {boolean} isSynced Whether the field’s value is kept the same in every locale while it
 * can be edited in the given locale, which is another locale, with the `sync` i18n strategy.
 * @property {boolean} areKeysDuplicated Whether the field’s keys are copied from the default
 * locale to the given locale, which is another locale, while the values can be edited. KeyValue
 * field only.
 * @property {boolean} isShown Whether the field is shown in the given locale.
 */

/**
 * Work out how the given field can be edited or previewed in the given locale, according to its
 * `i18n` option. A field without an option of its own is duplicated along with an ancestor using
 * the `duplicate` strategy, so it’s shown read-only in the other locales like the ancestor, rather
 * than leaving an empty List item or Object field there. The same goes for the `sync` strategy,
 * except that the field can be edited there. A rich text editor component’s subfield isn’t part of
 * the entry’s fields, so it only has its own option.
 * @param {object} args Arguments.
 * @param {EntryDraft | null | undefined} args.draft Entry draft.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale of the pane.
 * @param {FlattenedEntryContent} args.valueMap Values in the locale.
 * @param {boolean} [args.inEditorComponent] Whether the field is a subfield of a rich text editor
 * component, which is always shown.
 * @returns {FieldLocaleAccess} Result.
 */
export const getFieldLocaleAccess = ({
  draft,
  fieldConfig,
  keyPath,
  locale,
  valueMap,
  inEditorComponent = false,
}) => {
  const { i18n = false } = fieldConfig;
  const { i18nEnabled, defaultLocale } = getDraftI18nConfig(draft);
  const inOtherLocale = i18nEnabled && locale !== defaultLocale;
  const canTranslate = i18nEnabled && isFieldTranslatable(i18n);
  // Another locale only comes with i18n, which comes with the draft
  const _draft = /** @type {EntryDraft} */ (draft);

  // The default locale doesn’t follow itself, so the ancestors are only looked up for the others
  const inheritedI18n = !inOtherLocale
    ? undefined
    : inEditorComponent
      ? i18n
      : getInheritedI18nOption({
          fieldConfig,
          getFieldArgs: {
            collectionName: _draft.collectionName,
            fileName: _draft.fileName,
            isIndexFile: _draft.isIndexFile,
            keyPath,
            valueMap,
          },
        });

  const isDuplicated = inheritedI18n === 'duplicate';
  // A rich text editor component’s values live in the document of each locale, so they can’t be
  // kept in sync, and a subfield using the `sync` strategy works like a translatable one there
  const isSynced = !inEditorComponent && inheritedI18n === 'sync';
  const areKeysDuplicated = inOtherLocale && i18n === 'duplicate_keys';

  return {
    canTranslate,
    isDuplicated,
    isSynced,
    areKeysDuplicated,
    isShown:
      inEditorComponent ||
      locale === defaultLocale ||
      canTranslate ||
      isDuplicated ||
      isSynced ||
      areKeysDuplicated,
  };
};
