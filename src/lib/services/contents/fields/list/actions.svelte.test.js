// @vitest-environment happy-dom
// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';
import { isExpanded, syncExpanderStates } from '$lib/services/contents/editor/fields';
import { scrollToAddedListItem } from '$lib/services/contents/editor/scroll';
import { createListActions } from '$lib/services/contents/fields/list/actions.svelte';
import {
  copyListItem,
  prepareListItemPaste,
  readListItem,
} from '$lib/services/contents/fields/list/clipboard';
import {
  createListItem,
  getInitialListExpanderStates,
} from '$lib/services/contents/fields/list/items';
import {
  insertListItem,
  moveListItem,
  removeListItem,
  restoreListItem,
} from '$lib/services/contents/fields/list/mutations';
import {
  getPastedItemToast,
  showListItemClipboardToast,
} from '$lib/services/contents/fields/list/paste-toast';

vi.mock('@sveltia/i18n', () => ({ _: (key) => key }));
vi.mock('@sveltia/utils/misc', async (importOriginal) => ({
  ...(await importOriginal()),
  sleep: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/services/contents/draft/update/list', () => ({
  updateListFieldForLocales: vi.fn(),
}));
vi.mock('$lib/services/contents/editor/fields', () => ({
  isExpanded: vi.fn(() => true),
  syncExpanderStates: vi.fn(),
}));
vi.mock('$lib/services/contents/editor/scroll', () => ({
  getStickyToolbarBottom: vi.fn(() => 42),
  scrollToAddedListItem: vi.fn(() => Promise.resolve()),
}));
vi.mock('$lib/services/contents/fields/list/clipboard', () => ({
  copyListItem: vi.fn(() => Promise.resolve()),
  prepareListItemPaste: vi.fn(),
  readListItem: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/list/helpers', () => ({
  getListFieldInfo: vi.fn(({ field }) => ({ hasSingleSubField: !!field })),
}));
vi.mock('$lib/services/contents/fields/list/items', () => ({
  createListItem: vi.fn(() => ({ new: true })),
  getInitialListExpanderStates: vi.fn(() => ({ 'list#': true })),
}));
vi.mock('$lib/services/contents/fields/list/mutations', () => ({
  insertListItem: vi.fn(),
  moveListItem: vi.fn(),
  removeListItem: vi.fn(),
  restoreListItem: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/list/paste-toast', () => ({
  getPastedItemToast: vi.fn(),
  showListItemClipboardToast: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/list/removed-items', () => ({
  getNestedExpanderStates: vi.fn(() => [['.0.sub#', false]]),
}));

/**
 * Create a list element holding the given number of items, each with an expander button.
 * @param {number} count Number of items.
 * @returns {HTMLElement} List element.
 */
const createListElement = (count) => {
  const list = document.createElement('div');

  list.innerHTML = '<div><div class="item"><button></button></div></div>'.repeat(count);
  document.body.append(list);

  return list;
};

/**
 * Create the actions with stubbed collaborators.
 * @param {object} [overrides] Overrides.
 * @param {object} [overrides.state] Overrides of the list state.
 * @param {object} [overrides.args] Overrides of the arguments.
 * @returns {object} Actions, and what they were created with.
 */
const setup = ({ state = {}, args = {} } = {}) => {
  const draft = { defaultLocale: 'en', expanderStates: { _: {} } };
  const entryDraft = { current: draft };
  const removedItems = { remember: vi.fn(), add: vi.fn(), drop: vi.fn(), shift: vi.fn() };

  const listState = {
    locale: 'en',
    keyPath: 'list',
    typedKeyPath: 'list',
    fieldConfig: { name: 'list', i18n: true, fields: [] },
    pairedItems: false,
    itemCount: 2,
    ...state,
  };

  const list = createListElement(listState.itemCount + 1);

  const actions = createListActions({
    entryDraft,
    fieldId: 'f1',
    valueStoreKey: 'currentValues',
    componentName: undefined,
    inEditorComponent: false,
    removedItems,
    resolveType: () => ({ subFields: [{ name: 'sub' }] }),
    getListState: () => listState,
    getItemCount: () => listState.itemCount,
    getListElement: () => list,
    getTopToolbar: () => undefined,
    ...args,
  });

  return { actions, draft, entryDraft, removedItems, list, listState };
};

/**
 * Make `updateListFieldForLocales` run the manipulation for each of the given locales.
 * @param {Record<string, any[]>} lists Value list of each locale.
 */
const mockLocales = (lists) => {
  vi.mocked(updateListFieldForLocales).mockImplementation(({ manipulate }) => {
    Object.entries(lists).forEach(([locale, valueList]) => {
      manipulate({ valueList, expanderStateList: [], locale });
    });
  });
};

beforeEach(() => {
  document.body.innerHTML = '';
  mockLocales({ en: [] });
  vi.mocked(prepareListItemPaste).mockResolvedValue(undefined);
  vi.mocked(readListItem).mockResolvedValue(undefined);
  vi.mocked(getPastedItemToast).mockReturnValue(undefined);
  vi.mocked(removeListItem).mockReturnValue(undefined);
});

describe('createListActions()', () => {
  test('does nothing once the draft is gone', async () => {
    const { actions, entryDraft } = setup();

    entryDraft.current = null;

    actions.updateExpanderStates({ a: true });
    actions.initializeExpanderStates();
    await actions.addItem();
    await actions.copyItem(0);
    await actions.pasteItem(0);
    await actions.removeItem(0);
    await actions.restoreItem({ id: 'a', index: 0, values: {}, nestedExpanderStates: [] });
    actions.moveItem(0, 1);

    expect(syncExpanderStates).not.toHaveBeenCalled();
    expect(updateListFieldForLocales).not.toHaveBeenCalled();
    expect(copyListItem).not.toHaveBeenCalled();
    expect(readListItem).not.toHaveBeenCalled();
  });

  describe('updateExpanderStates()', () => {
    test('syncs the given states', () => {
      const { actions, draft } = setup();

      actions.updateExpanderStates({ a: true });

      expect(syncExpanderStates).toHaveBeenCalledWith({ draft, stateMap: { a: true } });
    });
  });

  describe('initializeExpanderStates()', () => {
    test('syncs the initial states with the field options', () => {
      const { actions, draft } = setup({
        state: {
          fieldConfig: { fields: [], collapsed: 'auto', minimize_collapsed: true },
        },
      });

      actions.initializeExpanderStates();

      expect(getInitialListExpanderStates).toHaveBeenCalledWith({
        draft,
        keyPath: 'list',
        itemCount: 2,
        locale: 'en',
        collapsed: 'auto',
        minimizeCollapsed: true,
      });
      expect(syncExpanderStates).toHaveBeenCalledWith({ draft, stateMap: { 'list#': true } });
    });

    test('defaults `minimize_collapsed` to false', () => {
      const { actions } = setup();

      actions.initializeExpanderStates();

      expect(getInitialListExpanderStates).toHaveBeenCalledWith(
        expect.objectContaining({ collapsed: undefined, minimizeCollapsed: false }),
      );
    });
  });

  describe('addItem()', () => {
    test('adds an item to the end by default, and passes the list options on', async () => {
      const valueList = [];

      mockLocales({ en: valueList });

      const { actions, draft, removedItems } = setup();

      await actions.addItem();

      expect(updateListFieldForLocales).toHaveBeenCalledWith(
        expect.objectContaining({
          draft,
          locale: 'en',
          i18n: true,
          pairedItems: false,
          valueStoreKey: 'currentValues',
          keyPath: 'list',
        }),
      );
      expect(removedItems.shift).toHaveBeenCalledWith(2);
      expect(createListItem).toHaveBeenCalledWith(
        expect.objectContaining({
          valueList,
          keyPath: 'list',
          subFields: [{ name: 'sub' }],
          hasSingleSubField: false,
          typeKey: 'type',
          locale: 'en',
          defaultLocale: 'en',
          sourceItem: undefined,
        }),
      );
      expect(insertListItem).toHaveBeenCalledWith(
        { valueList, expanderStateList: [] },
        { index: 2, item: { new: true }, replace: false },
      );
      expect(removedItems.remember).toHaveBeenCalledWith(valueList, 'en');
      expect(syncExpanderStates).toHaveBeenCalledWith({ draft, stateMap: { 'list#': true } });
    });

    test('adds an item to the top with `add_to_top`', async () => {
      const { actions, removedItems } = setup({
        state: { fieldConfig: { fields: [], add_to_top: true } },
      });

      await actions.addItem();

      expect(removedItems.shift).toHaveBeenCalledWith(0);
    });

    test('adds an item of the given type at the given index, from the given sources', async () => {
      mockLocales({ en: [], fr: [] });

      const { actions } = setup({
        state: {
          fieldConfig: { types: [{ name: 'a' }], typeKey: 'kind' },
        },
      });

      await actions.addItem({ index: 1, dupIndex: 0, type: 'a', sourceItems: { en: { a: 1 } } });

      expect(createListItem).toHaveBeenCalledWith(
        expect.objectContaining({
          dupIndex: 0,
          type: 'a',
          types: [{ name: 'a' }],
          typeKey: 'kind',
          sourceItem: { a: 1 },
          locale: 'en',
        }),
      );
      expect(createListItem).toHaveBeenCalledWith(
        expect.objectContaining({ sourceItem: undefined, locale: 'fr', defaultLocale: 'en' }),
      );

      const [{ renewedValues: first }, { renewedValues: second }] = vi
        .mocked(createListItem)
        .mock.calls.flat();

      expect(first).toBe(second);
    });

    test('leaves the removed items in place when replacing an item', async () => {
      const { actions, removedItems } = setup();

      await actions.addItem({ index: 0, replace: true });

      expect(removedItems.shift).not.toHaveBeenCalled();
      expect(insertListItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ index: 0, replace: true }),
      );
    });

    test('uses the target locale as the default locale in an editor component', async () => {
      mockLocales({ fr: [] });

      const { actions } = setup({ args: { inEditorComponent: true } });

      await actions.addItem();

      expect(createListItem).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'fr', defaultLocale: 'fr' }),
      );
    });

    test('exposes the index of the item being added until it’s rendered', async () => {
      const { actions } = setup();
      const promise = actions.addItem({ index: 1 });

      expect(actions.addedItemIndex).toBe(1);

      await promise;

      expect(actions.addedItemIndex).toBeUndefined();
    });

    test('focuses the added item and scrolls it into view, below the toolbar', async () => {
      const { actions, list } = setup();
      const item = list.children[2].querySelector('.item');

      await actions.addItem();

      expect(item.style.scrollMarginTop).toBe('42px');
      expect(document.activeElement).toBe(item.querySelector('button'));
      expect(scrollToAddedListItem).toHaveBeenCalledWith(expect.objectContaining({ item, list }));
    });

    test('stops following an item once another one has been added', async () => {
      const { actions } = setup();

      await actions.addItem({ index: 0 });

      const { isOutdated } = vi.mocked(scrollToAddedListItem).mock.calls[0][0];

      expect(isOutdated()).toBe(false);

      await actions.addItem({ index: 1 });

      expect(isOutdated()).toBe(true);
    });

    test('copes with an item without a button', async () => {
      const { actions, list } = setup();

      list.children[0].querySelector('button').remove();

      await actions.addItem({ index: 0 });

      expect(scrollToAddedListItem).toHaveBeenCalled();
    });

    test('skips revealing an item that isn’t there', async () => {
      const { actions } = setup({ args: { getListElement: () => undefined } });

      await actions.addItem();

      expect(scrollToAddedListItem).not.toHaveBeenCalled();
    });
  });

  describe('copyItem()', () => {
    test('copies the item and tells so', async () => {
      const { actions, draft, listState } = setup();

      await actions.copyItem(1);

      expect(copyListItem).toHaveBeenCalledWith({
        draft,
        valueStoreKey: 'currentValues',
        fieldConfig: listState.fieldConfig,
        keyPath: 'list',
        typedKeyPath: 'list',
        index: 1,
        locale: 'en',
        pairedItems: false,
        componentName: undefined,
      });
      expect(showListItemClipboardToast).toHaveBeenCalledWith('success', 'list_item_copied');
    });
  });

  describe('pasteItem()', () => {
    const copied = { data: {}, files: new Map() };

    const result = {
      type: 'a',
      items: { en: { a: 1 } },
      droppedCount: 1,
      missingFileCount: 2,
    };

    test('tells when there’s nothing to paste', async () => {
      const { actions } = setup();

      await actions.pasteItem(0);

      expect(showListItemClipboardToast).toHaveBeenCalledWith('info', 'no_list_item_to_paste');
      expect(prepareListItemPaste).not.toHaveBeenCalled();
    });

    test('tells when the item doesn’t fit the list', async () => {
      vi.mocked(readListItem).mockResolvedValue(copied);

      const { actions, draft, listState } = setup({ args: { componentName: 'image' } });

      await actions.pasteItem(0);

      expect(prepareListItemPaste).toHaveBeenCalledWith({
        draft,
        valueStoreKey: 'currentValues',
        copied,
        fieldConfig: listState.fieldConfig,
        typedKeyPath: 'list',
        componentName: 'image',
        inEditorComponent: false,
      });
      expect(showListItemClipboardToast).toHaveBeenCalledWith('error', 'list_item_not_compatible');
      expect(insertListItem).not.toHaveBeenCalled();
    });

    test('leaves it if another entry has been opened in the meantime', async () => {
      vi.mocked(readListItem).mockResolvedValue(copied);

      const { actions, entryDraft } = setup();

      vi.mocked(prepareListItemPaste).mockImplementation(async () => {
        entryDraft.current = { defaultLocale: 'en' };

        return result;
      });

      await actions.pasteItem(0);

      expect(insertListItem).not.toHaveBeenCalled();
      expect(showListItemClipboardToast).not.toHaveBeenCalled();
    });

    test('adds the item, without a toast when nothing was left out', async () => {
      vi.mocked(readListItem).mockResolvedValue(copied);
      vi.mocked(prepareListItemPaste).mockResolvedValue(result);

      const { actions } = setup();

      await actions.pasteItem(1, { replace: true });

      expect(createListItem).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'a', sourceItem: { a: 1 } }),
      );
      expect(insertListItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ index: 1, replace: true }),
      );
      expect(getPastedItemToast).toHaveBeenCalledWith({ droppedCount: 1, missingFileCount: 2 });
      expect(showListItemClipboardToast).not.toHaveBeenCalled();
    });

    test('shows the toast about what was left out', async () => {
      vi.mocked(readListItem).mockResolvedValue(copied);
      vi.mocked(prepareListItemPaste).mockResolvedValue(result);
      vi.mocked(getPastedItemToast).mockReturnValue({ status: 'warning', message: 'Dropped' });

      const { actions } = setup();

      await actions.pasteItem(0);

      expect(insertListItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ replace: false }),
      );
      expect(showListItemClipboardToast).toHaveBeenCalledWith('warning', 'Dropped');
    });
  });

  describe('removeItem()', () => {
    test('remembers the removed values per locale, leaving out a missing one', async () => {
      const en = [{}];

      mockLocales({ en, fr: [] });
      vi.mocked(removeListItem).mockImplementation(({ valueList }) =>
        valueList === en ? { a: 1 } : undefined,
      );
      vi.mocked(isExpanded).mockReturnValue(false);

      const { actions, draft, removedItems } = setup();

      await actions.removeItem(0);

      const [removedItem] = vi.mocked(removedItems.add).mock.calls[0];

      expect(removedItem).toMatchObject({
        index: 0,
        expanded: false,
        nestedExpanderStates: [['.0.sub#', false]],
        values: { en: { a: 1 } },
      });
      expect(isExpanded).toHaveBeenCalledWith(draft, 'list.0');
      expect(removeListItem).toHaveBeenCalledWith(expect.anything(), {
        index: 0,
        keyPath: 'list',
        tagItems: true,
      });
      expect(removedItems.remember).toHaveBeenCalledWith(en, 'en');
    });

    test('doesn’t tag the items of a list with a single subfield', async () => {
      const { actions } = setup({ state: { fieldConfig: { field: { name: 'sub' } } } });

      await actions.removeItem(0);

      expect(removeListItem).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tagItems: false }),
      );
    });

    test('moves focus to the Restore button', async () => {
      const { actions, removedItems } = setup();
      const button = document.createElement('button');

      document.body.append(button);
      vi.mocked(removedItems.add).mockImplementation(({ id }) => {
        button.id = `list-f1-restore-${id}`;
      });

      await actions.removeItem(0);

      expect(document.activeElement).toBe(button);
    });
  });

  describe('restoreItem()', () => {
    const removedItem = {
      id: 'a',
      index: 1,
      values: { en: { a: 1 } },
      expanded: true,
      nestedExpanderStates: [['.sub#', false]],
    };

    test('restores the item in the locales it was removed from', async () => {
      const en = [];

      mockLocales({ en, fr: [] });

      const { actions, draft, removedItems } = setup();

      await actions.restoreItem(removedItem);

      expect(removedItems.drop).toHaveBeenCalledWith('a');
      expect(restoreListItem).toHaveBeenCalledTimes(1);
      expect(restoreListItem).toHaveBeenCalledWith(
        { valueList: en, expanderStateList: [] },
        { index: 1, item: { a: 1 }, expanded: true, keyPath: 'list', tagItems: true },
      );
      expect(removedItems.remember).toHaveBeenCalledWith(en, 'en');
      expect(syncExpanderStates).toHaveBeenCalledWith({
        draft,
        stateMap: { 'list.1.sub#': false },
      });
    });

    test('moves focus to the expander button of the item', async () => {
      const { actions, list } = setup();

      await actions.restoreItem(removedItem);

      expect(document.activeElement).toBe(list.children[1].querySelector('button'));
    });

    test('copes with an item that isn’t there', async () => {
      const { actions } = setup({ args: { getListElement: () => undefined } });

      await expect(actions.restoreItem(removedItem)).resolves.toBeUndefined();
    });
  });

  describe('moveItem()', () => {
    test('moves the item and remembers the outcome', () => {
      const en = [];

      mockLocales({ en });

      const { actions, removedItems } = setup();

      actions.moveItem(0, 1);

      expect(moveListItem).toHaveBeenCalledWith(
        { valueList: en, expanderStateList: [] },
        { from: 0, to: 1, keyPath: 'list', tagItems: true },
      );
      expect(removedItems.remember).toHaveBeenCalledWith(en, 'en');
    });
  });
});
