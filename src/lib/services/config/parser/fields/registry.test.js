import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { checkCommonFieldOptions } from '$lib/services/config/parser/fields/common';
import { parseCustomFieldConfig } from '$lib/services/config/parser/fields/custom';
import {
  fieldParsers,
  parseFieldConfig,
  parseFields,
} from '$lib/services/config/parser/fields/registry';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/fields/common');
vi.mock('$lib/services/config/parser/fields/custom');
vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/** @type {any} */
const context = { collection: { name: 'posts' } };

describe('fieldParsers', () => {
  test('starts out empty, leaving the built-in parsers to the `fields` index module', () => {
    expect(fieldParsers).toEqual({});
  });
});

describe('parseFieldConfig', () => {
  const stringParser = vi.fn();
  const listParser = vi.fn();

  beforeEach(() => {
    Object.assign(fieldParsers, { string: stringParser, list: listParser });
  });

  afterEach(() => {
    delete fieldParsers.string;
    delete fieldParsers.list;
  });

  test('extends the typed key path with the field name', () => {
    /** @type {any} */
    const config = { name: 'title', widget: 'list' };

    parseFieldConfig({ config, context: { ...context, typedKeyPath: 'items' }, collectors });

    const expected = { config, context: { ...context, typedKeyPath: 'items.title' }, collectors };

    expect(checkCommonFieldOptions).toHaveBeenCalledExactlyOnceWith(expected);
    expect(listParser).toHaveBeenCalledExactlyOnceWith(expected);
    expect(stringParser).not.toHaveBeenCalled();
  });

  test('starts the typed key path with the field name at the top level', () => {
    /** @type {any} */
    const config = { name: 'title', widget: 'list' };

    parseFieldConfig({ config, context, collectors });

    expect(listParser).toHaveBeenCalledExactlyOnceWith({
      config,
      context: { ...context, typedKeyPath: 'title' },
      collectors,
    });
  });

  test('does not change the given context', () => {
    const ctx = { ...context, typedKeyPath: 'items' };

    parseFieldConfig({ config: /** @type {any} */ ({ name: 'title' }), context: ctx, collectors });

    expect(ctx.typedKeyPath).toBe('items');
  });

  test('treats a field without a type as a String field', () => {
    /** @type {any} */
    const config = { name: 'title' };

    parseFieldConfig({ config, context, collectors });

    expect(stringParser).toHaveBeenCalledOnce();
    expect(parseCustomFieldConfig).not.toHaveBeenCalled();
  });

  test('runs only the common checks for a built-in type without its own parser', () => {
    /** @type {any} */
    const config = { name: 'flag', widget: 'boolean' };

    parseFieldConfig({ config, context, collectors });

    expect(checkCommonFieldOptions).toHaveBeenCalledOnce();
    expect(parseCustomFieldConfig).not.toHaveBeenCalled();
    expect(stringParser).not.toHaveBeenCalled();
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('parses an unknown type as a custom field', () => {
    /** @type {any} */
    const config = { name: 'photo', widget: 'derived-image' };

    parseFieldConfig({ config, context, collectors });

    expect(parseCustomFieldConfig).toHaveBeenCalledExactlyOnceWith({
      config,
      context: { ...context, typedKeyPath: 'photo' },
      collectors,
    });
  });

  test('prefers a registered parser over the custom field parser', () => {
    const customParser = vi.fn();

    fieldParsers['derived-image'] = customParser;

    try {
      parseFieldConfig({
        config: /** @type {any} */ ({ name: 'photo', widget: 'derived-image' }),
        context,
        collectors,
      });
    } finally {
      delete fieldParsers['derived-image'];
    }

    expect(customParser).toHaveBeenCalledOnce();
    expect(parseCustomFieldConfig).not.toHaveBeenCalled();
  });

  test('reports the unsupported Date field type', () => {
    /** @type {any} */
    const config = { name: 'date', widget: 'date' };

    parseFieldConfig({ config, context, collectors });

    const expected = { config, context: { ...context, typedKeyPath: 'date' }, collectors };

    expect(parseCustomFieldConfig).toHaveBeenCalledExactlyOnceWith(expected);
    expect(addMessage).toHaveBeenCalledExactlyOnceWith({ ...expected, strKey: 'date_field_type' });
  });
});

describe('parseFields', () => {
  const stringParser = vi.fn();

  beforeEach(() => {
    fieldParsers.string = stringParser;
  });

  afterEach(() => {
    delete fieldParsers.string;
  });

  test('parses only the fields whose names pass the check', () => {
    vi.mocked(checkName).mockImplementation(({ name }) => name !== 'bad name');

    /** @type {any[]} */
    const fields = [{ name: 'title' }, { name: 'bad name' }, { name: 'body' }];

    parseFields(fields, context, collectors);

    expect(vi.mocked(checkName).mock.calls.map(([args]) => [args.name, args.index])).toEqual([
      ['title', 0],
      ['bad name', 1],
      ['body', 2],
    ]);
    expect(stringParser.mock.calls.map(([args]) => args.config.name)).toEqual(['title', 'body']);
  });

  test('checks every name against the same name counts', () => {
    vi.mocked(checkName).mockReturnValue(true);

    parseFields(/** @type {any[]} */ ([{ name: 'a' }, { name: 'b' }]), context, collectors);

    const [[first], [second]] = vi.mocked(checkName).mock.calls;

    expect(first).toMatchObject({ strKeyBase: 'field_name', context, collectors, nameCounts: {} });
    expect(second.nameCounts).toBe(first.nameCounts);
  });

  test('uses fresh name counts for each list of fields', () => {
    vi.mocked(checkName).mockReturnValue(true);

    parseFields(/** @type {any[]} */ ([{ name: 'a' }]), context, collectors);
    parseFields(/** @type {any[]} */ ([{ name: 'a' }]), context, collectors);

    const [[first], [second]] = vi.mocked(checkName).mock.calls;

    expect(second.nameCounts).not.toBe(first.nameCounts);
  });

  test('does nothing for missing fields', () => {
    parseFields(/** @type {any} */ (undefined), context, collectors);
    parseFields([], context, collectors);

    expect(checkName).not.toHaveBeenCalled();
    expect(stringParser).not.toHaveBeenCalled();
  });
});
