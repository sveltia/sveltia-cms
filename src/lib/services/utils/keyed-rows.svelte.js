import { moveListItem } from '$lib/services/utils/drag-sorting';

/**
 * Reactive rows of a list editor, created with {@link createKeyedRows}.
 * @template T
 * @typedef {object} KeyedRows
 * @property {T[]} values Row values, deeply reactive, so a row can be bound to with `bind:`.
 * @property {number[]} ids Stable row identifiers, in the same order as the values.
 * @property {(index: number, value: T) => void} insert Insert a row with a new identifier.
 * @property {(index: number) => void} remove Remove a row.
 * @property {(from: number, to: number) => void} move Move a row to another position.
 * @property {(values: T[], options?: { keepIds?: boolean }) => void} replace Replace all the rows.
 */

/**
 * Create the rows of a list editor, each with a stable identifier to key an `{#each}` block with,
 * so the block keeps following a row as the list is reordered rather than following its position.
 * That way the input a user is typing into keeps the focus, and a dragged row keeps its element.
 * @template T
 * @param {T[]} [initialValues] Initial row values.
 * @returns {KeyedRows<T>} Rows.
 */
export const createKeyedRows = (initialValues = []) => {
  let nextId = 0;

  /**
   * Get a new row identifier.
   * @returns {number} Identifier.
   */
  const getNextId = () => {
    nextId += 1;

    return nextId - 1;
  };

  /** @type {T[]} */
  let values = $state(initialValues);
  /** @type {number[]} */
  let ids = $state(initialValues.map(getNextId));

  return {
    /**
     * Row values.
     * @returns {T[]} Values.
     */
    get values() {
      return values;
    },
    /**
     * Row identifiers.
     * @returns {number[]} Identifiers.
     */
    get ids() {
      return ids;
    },
    /**
     * Insert a row, giving it a new identifier.
     * @param {number} index Index to insert at.
     * @param {T} value Row value.
     */
    insert: (index, value) => {
      values.splice(index, 0, value);
      ids.splice(index, 0, getNextId());
    },
    /**
     * Remove a row.
     * @param {number} index Row index.
     */
    remove: (index) => {
      values.splice(index, 1);
      ids.splice(index, 1);
    },
    /**
     * Move a row, along with its identifier, to another position.
     * @param {number} from Source index.
     * @param {number} to Destination index.
     */
    move: (from, to) => {
      values = moveListItem(values, from, to);
      ids = moveListItem(ids, from, to);
    },
    /**
     * Replace all the rows, giving each a new identifier.
     * @param {T[]} newValues Row values.
     * @param {object} [options] Options.
     * @param {boolean} [options.keepIds] Whether to keep the existing identifiers by position
     * instead, so the rows already rendered are reused for the new values, and only the rows
     * beyond the current count get new identifiers.
     */
    replace: (newValues, { keepIds = false } = {}) => {
      const currentIds = ids;

      values = newValues;
      ids = newValues.map((_value, index) =>
        keepIds && index < currentIds.length ? currentIds[index] : getNextId(),
      );
    },
  };
};
