import { _ } from '@sveltia/i18n';

import { getLocaleLabel } from '$lib/services/contents/i18n';
import { DEFAULT_LOCALE_KEY } from '$lib/services/contents/i18n/config/constants';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 */

/**
 * @typedef {'revert' | 'restore' | 'clear'} ResetAction
 * Action taken on the values of the entry draft: revert the changes, restore the default values,
 * or clear the fields.
 */

/**
 * @typedef {'field' | 'locale' | 'entry'} ResetScope
 * What the action applies to: a single field, the fields in a locale, as the content options menu
 * of an editor pane offers, or the fields in every locale, as the editor options menu offers.
 */

/**
 * The actions in the order the menus list them.
 * @type {ResetAction[]}
 */
export const RESET_ACTIONS = ['revert', 'restore', 'clear'];

/**
 * I18n keys of the menu item labels, keyed by scope and action.
 * @type {Record<ResetScope, Record<ResetAction, string>>}
 */
const LABEL_KEYS = {
  field: { revert: 'revert_changes', restore: 'restore_default', clear: 'clear' },
  locale: { revert: 'revert_changes', restore: 'restore_default', clear: 'clear_all' },
  entry: { revert: 'revert_all_changes', restore: 'restore_default', clear: 'clear_all' },
};

/**
 * I18n keys of the confirmation messages, keyed by action.
 * @type {Record<ResetAction, string>}
 */
const MESSAGE_KEYS = {
  revert: 'confirm_reverting_changes',
  restore: 'confirm_restoring_defaults',
  clear: 'confirm_clearing_fields',
};

/**
 * Get the label of a menu item, which is also the title and the OK button label of the dialog
 * confirming the action.
 * @param {ResetAction} action Action.
 * @param {ResetScope} scope Scope.
 * @returns {string} Localized label.
 */
export const getResetLabel = (action, scope) => _(LABEL_KEYS[scope][action]);

/**
 * Get the message of the dialog confirming an action on the fields in a locale or the entire entry.
 * The content of a monolingual entry has no locale to name, so it’s referred to as the entry.
 * @param {ResetAction} action Action.
 * @param {InternalLocaleCode} [locale] Locale, if the action applies to a single locale.
 * @returns {string} Localized message.
 */
export const getResetConfirmation = (action, locale) =>
  locale && locale !== DEFAULT_LOCALE_KEY
    ? _(`${MESSAGE_KEYS[action]}_x_locale`, {
        values: { locale: getLocaleLabel(locale) ?? locale },
      })
    : _(MESSAGE_KEYS[action]);
