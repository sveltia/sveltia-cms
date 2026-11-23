import { validateFields } from '$lib/services/contents/draft/validate/fields';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Validate the values of the rich text editor components in the given entry draft, which are
 * stored in its `extraValues`, and merge the results into the draft so the field editors show the
 * messages. Used when the dialog of a component in `dialog` mode is confirmed.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale the component is edited in.
 * @param {string} args.keyPathPrefix Key path prefix of the component, e.g. `body:c12:`.
 * @returns {boolean} Whether the values of the given component are valid.
 */
export const validateComponentValues = ({ draft, locale, keyPathPrefix }) => {
  const { validities, validationMessages } = validateFields('extraValues', { draft });

  Object.keys(draft.validities).forEach((loc) => {
    Object.assign(draft.validities[loc], validities[loc]);
    // The field editors show the messages, not the validity flags
    Object.assign(draft.validationMessages[loc], validationMessages[loc]);
  });

  return !Object.entries(validities[locale] ?? {}).some(
    ([key, validity]) => key.startsWith(keyPathPrefix) && !validity.valid,
  );
};
