import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import SelectSingle from './select-single.svelte';

const options = [
  { label: 'Apple', value: 'apple', searchValue: 'apple' },
  { label: 'Banana', value: 'banana', searchValue: 'banana' },
];

describe('SelectSingle', () => {
  test('offers a few options as radio buttons, writing the value back', async () => {
    const props = $state({
      fieldId: 'fruit',
      fieldConfig: { name: 'fruit', widget: 'select', options: [] },
      currentValue: 'apple',
      options,
    });

    await render(SelectSingle, /** @type {any} */ (props));
    await sleep(150);

    const group = page.getByRole('radiogroup');

    await expect.element(group).toHaveAttribute('aria-labelledby', 'fruit-label');
    await expect.element(group).toHaveAttribute('aria-required', 'true');
    await expect.element(group.getByRole('radio', { name: 'Apple' })).toBeChecked();

    await group.getByRole('radio', { name: 'Banana' }).click();
    expect(props.currentValue).toBe('banana');
  });

  test('offers nothing but the empty option without options', async () => {
    await render(
      SelectSingle,
      /** @type {any} */ ({
        fieldId: 'fruit',
        fieldConfig: { name: 'fruit', widget: 'select', options: [] },
        currentValue: '',
        required: false,
        options: [],
      }),
    );
    await sleep(150);

    await expect.element(page.getByRole('radio', { name: '(None)' })).toBeChecked();
    expect(page.getByRole('radio').elements()).toHaveLength(1);
  });

  test('offers an empty option when the field is optional', async () => {
    const props = $state({
      fieldId: 'count',
      fieldConfig: { name: 'count', widget: 'select', options: [] },
      currentValue: 2,
      required: false,
      options: [
        { label: 'One', value: 1, searchValue: '1' },
        { label: 'Two', value: 2, searchValue: '2' },
      ],
    });

    await render(SelectSingle, /** @type {any} */ (props));
    await sleep(150);

    expect(page.getByRole('radio').elements()).toHaveLength(3);
    await expect.element(page.getByRole('radio', { name: 'One' })).toBeInTheDocument();
    await expect.element(page.getByRole('radio', { name: 'Two' })).toBeChecked();

    // A numeric field is cleared with `null`
    await page.getByRole('radio', { name: '(None)' }).click();
    expect(props.currentValue).toBeNull();
  });

  test('writes back boolean and `null` option values as they are', async () => {
    const props = $state({
      fieldId: 'fip',
      fieldConfig: { name: 'fip', widget: 'select', options: [] },
      currentValue: /** @type {boolean | null} */ (null),
      options: [
        { label: 'Yes', value: true, searchValue: 'true' },
        { label: 'No', value: false, searchValue: 'false' },
        { label: 'Not relevant', value: null, searchValue: 'null' },
      ],
    });

    await render(SelectSingle, /** @type {any} */ (props));
    await sleep(150);

    expect(page.getByRole('radio').elements()).toHaveLength(3);
    await expect.element(page.getByRole('radio', { name: 'Not relevant' })).toBeChecked();

    await page.getByRole('radio', { name: 'No' }).click();
    expect(props.currentValue).toBe(false);

    await page.getByRole('radio', { name: 'Yes' }).click();
    expect(props.currentValue).toBe(true);

    await page.getByRole('radio', { name: 'Not relevant' }).click();
    expect(props.currentValue).toBeNull();
  });

  test('clears an optional boolean field with `null`', async () => {
    const props = $state({
      fieldId: 'fip',
      fieldConfig: { name: 'fip', widget: 'select', options: [] },
      currentValue: /** @type {boolean | null} */ (null),
      required: false,
      options: [
        { label: 'Yes', value: true, searchValue: 'true' },
        { label: 'No', value: false, searchValue: 'false' },
      ],
    });

    await render(SelectSingle, /** @type {any} */ (props));
    await sleep(150);

    // `false` is a choice, not an empty value, so the empty option is still offered, and it’s
    // checked for the `null` value a new entry starts with
    expect(page.getByRole('radio').elements()).toHaveLength(3);
    await expect.element(page.getByRole('radio', { name: '(None)' })).toBeChecked();

    await page.getByRole('radio', { name: 'No', exact: true }).click();
    expect(props.currentValue).toBe(false);

    await page.getByRole('radio', { name: '(None)' }).click();
    expect(props.currentValue).toBeNull();
  });

  test('writes back boolean and `null` option values from a drop-down', async () => {
    const props = $state({
      fieldId: 'fip',
      fieldConfig: { name: 'fip', widget: 'select', options: [], dropdown_threshold: 2 },
      currentValue: /** @type {boolean | null} */ (true),
      options: [
        { label: 'Yes', value: true, searchValue: 'true' },
        { label: 'No', value: false, searchValue: 'false' },
        { label: 'Not relevant', value: null, searchValue: 'null' },
      ],
    });

    await render(SelectSingle, /** @type {any} */ (props));

    const select = page.getByRole('combobox');

    await expect.element(select).toHaveTextContent('Yes');

    await select.click();
    await sleep(150);
    await page.getByRole('option', { name: 'No' }).click();
    expect(props.currentValue).toBe(false);

    await select.click();
    await sleep(150);
    await page.getByRole('option', { name: 'Not relevant' }).click();
    expect(props.currentValue).toBeNull();
  });

  test('offers many options in a drop-down', async () => {
    const props = $state({
      fieldId: 'letter',
      fieldConfig: { name: 'letter', widget: 'select', options: [], dropdown_threshold: 3 },
      currentValue: 'b',
      invalid: true,
      options: ['a', 'b', 'c', 'd'].map((value) => ({ label: value, value, searchValue: value })),
    });

    await render(SelectSingle, /** @type {any} */ (props));

    const select = page.getByRole('combobox');

    await expect.element(select).toHaveTextContent('b');
    await expect.element(select).toHaveAttribute('aria-invalid', 'true');

    await select.click();
    await sleep(150);
    await page.getByRole('option', { name: 'd' }).click();
    expect(props.currentValue).toBe('d');
  });

  test('can be read-only', async () => {
    const props = $state({
      fieldId: 'fruit',
      fieldConfig: { name: 'fruit', widget: 'select', options: [] },
      currentValue: 'apple',
      readonly: true,
      options,
    });

    await render(SelectSingle, /** @type {any} */ (props));
    await sleep(150);

    await expect.element(page.getByRole('radiogroup')).toHaveAttribute('aria-readonly', 'true');
    await page.getByRole('radio', { name: 'Banana' }).click({ force: true });
    expect(props.currentValue).toBe('apple');
  });
});
