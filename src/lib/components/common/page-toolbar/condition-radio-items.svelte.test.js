import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import ConditionRadioItems from './condition-radio-items.svelte';

// Choosing an item takes the `Menu` around the items, so that’s tested with the Filter and Group
// menus

const options = [
  { label: 'Draft', field: 'draft', pattern: true },
  { label: 'Published', field: 'draft', pattern: false },
];

/**
 * Get the text and the checked state of each item.
 * @returns {string[]} Text of each item, followed by whether it’s checked.
 */
const getItems = () =>
  page
    .getByRole('menuitemradio')
    .elements()
    .map((el) => `${el.textContent?.replace(/\s+/g, ' ').trim()} ${el.ariaChecked}`);

describe('ConditionRadioItems', () => {
  test('lists a None item and an item for each option, checking the one applied', async () => {
    const currentView = createRawState(
      /** @type {any} */ ({ filter: { field: 'draft', pattern: false } }),
    );

    await render(ConditionRadioItems, {
      currentView,
      viewKey: 'filter',
      noneValue: undefined,
      options,
    });

    expect(getItems()).toEqual(['None false', 'Draft false', 'Published check true']);
  });

  test('checks the custom None item when nothing is applied', async () => {
    await render(ConditionRadioItems, {
      currentView: createRawState(/** @type {any} */ ({ group: null })),
      viewKey: 'group',
      noneValue: null,
      noneLabel: 'Ungrouped',
      options,
    });

    expect(getItems()).toEqual(['Ungrouped check true', 'Draft false', 'Published false']);
  });

  test('renders the None item alone without options', async () => {
    await render(ConditionRadioItems, {
      currentView: createRawState(/** @type {any} */ ({})),
      viewKey: 'filter',
      noneValue: undefined,
    });

    expect(getItems()).toEqual(['None check true']);
  });
});
