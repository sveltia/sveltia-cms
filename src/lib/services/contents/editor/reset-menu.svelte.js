/**
 * @import { ResetAction } from '$lib/services/contents/editor/reset';
 */

/**
 * Whether restoring the default values or clearing the fields would change anything.
 * @typedef {{ restore: boolean, clear: boolean }} ResetAvailability
 */

/**
 * State of a menu listing the reset actions, created with {@link createResetMenuState}.
 * @typedef {object} ResetMenuState
 * @property {ResetAvailability} availability Whether each of the costly actions would change
 * anything, as of the last {@link ResetMenuState.update} call.
 * @property {ResetAction} action Action last chosen from the menu, to be confirmed in a dialog.
 * @property {boolean} dialogOpen Whether the confirmation dialog is open. It can be bound to.
 * @property {() => void} update Check the availability again. Call it as the menu opens.
 * @property {(action: ResetAction) => void} select Choose an action, opening the confirmation
 * dialog.
 */

/**
 * Create the state of a menu listing the reset actions: the field options menu, the content options
 * menu of an editor pane or the editor options menu. Checking whether restoring the default values
 * or clearing the fields would change anything takes going through the whole field, locale or
 * entry, so it’s only done as the menu opens rather than on every change. Use it in a component.
 * @param {() => ResetAvailability | undefined} checkAvailability Function checking the
 * availability. It can return `undefined` to leave the availability as it is.
 * @returns {ResetMenuState} State.
 */
export const createResetMenuState = (checkAvailability) => {
  /** @type {ResetAvailability} */
  let availability = $state({ restore: false, clear: false });
  /** @type {ResetAction} */
  let action = $state('revert');
  let dialogOpen = $state(false);

  return {
    /**
     * Availability of the costly actions.
     * @returns {ResetAvailability} Availability.
     */
    get availability() {
      return availability;
    },
    /**
     * Action last chosen.
     * @returns {ResetAction} Action.
     */
    get action() {
      return action;
    },
    /**
     * Whether the confirmation dialog is open.
     * @returns {boolean} Result.
     */
    get dialogOpen() {
      return dialogOpen;
    },
    /**
     * Open or close the confirmation dialog.
     * @param {boolean} open Whether the dialog is open.
     */
    set dialogOpen(open) {
      dialogOpen = open;
    },
    /**
     * Check the availability again.
     */
    update: () => {
      availability = checkAvailability() ?? availability;
    },
    /**
     * Choose an action, opening the confirmation dialog.
     * @param {ResetAction} selectedAction Action.
     */
    select: (selectedAction) => {
      action = selectedAction;
      dialogOpen = true;
    },
  };
};
