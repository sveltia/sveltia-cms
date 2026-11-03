import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Assign the values that are only given when the entry draft is saved: the manual sort order of a
 * new entry, the auto-increment numbers and the `auto_now` dates. The numbers are assigned before
 * the slugs are created, so a slug template can use them, and the dates tell when the entry was
 * actually saved rather than when the draft was created.
 * @param {EntryDraft} draft Draft to save, updated in place.
 * @param {number} offset Number of new entries of the same collection saved along with this one
 * that have already taken the orders and numbers after the highest ones, so this one comes after
 * them.
 */
export const assignSaveTimeValues = (draft, offset) => {
  if (draft.isNew && draft.collection._type === 'entry') {
    assignManualSortOrder(draft, offset);
  }

  assignAutoIncrementValues(draft, offset);
  assignAutoNowValues(draft);
};
