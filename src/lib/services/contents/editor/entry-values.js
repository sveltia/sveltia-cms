import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
import { getBulkEditRowContext } from '$lib/services/contents/editor/bulk-edit-row';
import { getFieldEditorContext } from '$lib/services/contents/editor/field-context';
import { getDraftSharedValues } from '$lib/services/contents/i18n/shared-values';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { SharedValues } from '$lib/services/contents/i18n/shared-values';
 */

/**
 * Accessor to the entry a field editor belongs to. Each getter is reactive when called in a
 * reaction, e.g. a `$derived()`.
 * @typedef {object} EditorEntryValues
 * @property {(locale: InternalLocaleCode) => FlattenedEntryContent | undefined} getValues Get the
 * values of the entry in the given locale: those of the draft, or of the rich text editor component
 * being edited, in the entry editor, or those of the row with its pending edits applied in the bulk
 * editor.
 * @property {(locale: InternalLocaleCode) => SharedValues | undefined} getSharedValues Get the
 * values of the fields that aren’t localized, for reading them while another locale than the
 * default is edited. `undefined` in the bulk editor, which only edits the default locale, and in a
 * rich text editor component, whose values are localized along with the document.
 * @property {(locale: InternalLocaleCode) => string | undefined} getSlug Get the slug of the entry
 * in the given locale.
 */

/**
 * Get an accessor to the entry a field editor belongs to: the entry draft in the entry editor, or
 * the entry of the row in the bulk editor, which has no draft. A field editor reads the entry
 * through this, e.g. to resolve the `{{slug}}` and `{{fields.x}}` templates in the filters of a
 * Relation field, so it needs no special case for the bulk editor. The draft itself is not given to
 * the bulk editor, as it would turn on draft-only features there, like creating an entry with the
 * Relation field’s quick-add dialog. Call this while a component is being initialized, as it reads
 * the component contexts.
 * @returns {EditorEntryValues} Accessor.
 */
export const getEditorEntryValues = () => {
  const entryDraft = getEntryDraftContext();
  const { valueStoreKey = 'currentValues' } = getFieldEditorContext();
  const bulkEditRow = getBulkEditRowContext();

  /**
   * Get the values of the entry in a locale.
   * @type {EditorEntryValues['getValues']}
   */
  const getValues = (locale) => {
    const draft = entryDraft?.current;

    return draft ? draft[valueStoreKey]?.[locale] : bulkEditRow?.values;
  };

  /**
   * Get the values of the fields that aren’t localized.
   * @type {EditorEntryValues['getSharedValues']}
   */
  const getSharedValues = (locale) =>
    valueStoreKey === 'currentValues'
      ? getDraftSharedValues(entryDraft?.current, locale)
      : undefined;

  /**
   * Get the slug of the entry in a locale.
   * @type {EditorEntryValues['getSlug']}
   */
  const getSlug = (locale) => {
    const draft = entryDraft?.current;

    return draft ? (draft.currentSlugs[locale] ?? draft.currentSlugs._) : bulkEditRow?.slug;
  };

  return { getValues, getSharedValues, getSlug };
};
