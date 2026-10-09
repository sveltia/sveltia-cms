// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addObjectFields, removeObjectFields } from './object';

const { suspendAutoDuplication, copyDefaultLocaleValues, forEachTargetLocale } = vi.hoisted(() => ({
  suspendAutoDuplication: vi.fn((fn) => fn()),
  copyDefaultLocaleValues: vi.fn(({ content }) => ({ ...content, copied: true })),
  // Write to every locale for the `duplicate` strategy, to the given one otherwise
  forEachTargetLocale: vi.fn(({ valueStore, locale, i18n }, callback) => {
    Object.entries(valueStore ?? {}).forEach(([_locale, valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        callback(valueMap, _locale);
      }
    });
  }),
}));

vi.mock('$lib/services/contents/draft', () => ({ suspendAutoDuplication }));
vi.mock('$lib/services/contents/draft/update/locale', () => ({
  copyDefaultLocaleValues,
  forEachTargetLocale,
}));

describe('draft/update/object', () => {
  /** @type {any} */
  let draft;

  const fields = [
    { name: 'title', widget: 'string', default: 'Untitled' },
    { name: 'count', widget: 'number', value_type: 'int', default: 1 },
  ];

  const types = [
    { name: 'image', fields: [{ name: 'src', widget: 'string', default: 'a.png' }] },
    { name: 'empty' },
  ];

  beforeEach(() => {
    draft = {
      defaultLocale: 'en',
      currentValues: { en: { obj: null }, fr: { obj: null } },
      extraValues: { en: {}, fr: {} },
    };
  });

  describe('addObjectFields', () => {
    it('adds the subfields with their default values, enabling the object', () => {
      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', fields },
      });

      expect(draft.currentValues.en).toEqual({ 'obj.title': 'Untitled', 'obj.count': 1 });
      expect(draft.currentValues.fr).toEqual({ obj: null });
      expect(copyDefaultLocaleValues).not.toHaveBeenCalled();
      expect(suspendAutoDuplication).toHaveBeenCalledOnce();
    });

    it('keeps the values already there', () => {
      draft.currentValues.en['obj.title'] = 'Hello';

      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', fields },
      });

      expect(draft.currentValues.en).toEqual({ 'obj.title': 'Hello', 'obj.count': 1 });
    });

    it('writes the type and the subfields of that type', () => {
      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', types, typeKey: 'kind' },
        type: 'image',
      });

      expect(draft.currentValues.en).toEqual({ 'obj.kind': 'image', 'obj.src': 'a.png' });
    });

    it('uses the default type key and copes with a type without subfields', () => {
      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', types },
        type: 'empty',
      });

      expect(draft.currentValues.en).toEqual({ 'obj.type': 'empty' });
    });

    it('copes with an object without subfields', () => {
      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object' },
      });

      expect(draft.currentValues.en).toEqual({});
    });

    it('copies the default locale values in another locale', () => {
      addObjectFields({
        draft,
        locale: 'fr',
        keyPath: 'obj',
        fieldConfig: {
          name: 'obj',
          widget: 'object',
          i18n: true,
          fields: fields.map((field) => ({ ...field, i18n: true })),
        },
      });

      expect(copyDefaultLocaleValues).toHaveBeenCalledWith({
        draft,
        content: { 'obj.title': 'Untitled', 'obj.count': 1 },
        targetLanguage: 'fr',
        keyPathPrefix: 'obj',
      });
      expect(draft.currentValues.fr).toEqual({
        'obj.title': 'Untitled',
        'obj.count': 1,
        copied: true,
      });
      expect(draft.currentValues.en).toEqual({ obj: null });
    });

    it('writes every locale with the duplicate strategy', () => {
      addObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', i18n: 'duplicate', types },
        type: 'image',
      });

      expect(draft.currentValues.en).toEqual({ 'obj.type': 'image', 'obj.src': 'a.png' });
      expect(draft.currentValues.fr).toEqual({ 'obj.type': 'image', 'obj.src': 'a.png' });
    });

    it('writes to another value store', () => {
      addObjectFields({
        draft,
        valueStoreKey: 'extraValues',
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', fields },
      });

      expect(draft.extraValues.en).toEqual({ 'obj.title': 'Untitled', 'obj.count': 1 });
      expect(draft.currentValues.en).toEqual({ obj: null });
    });
  });

  describe('removeObjectFields', () => {
    beforeEach(() => {
      draft.currentValues = {
        en: { 'obj.title': 'Hello', 'obj.nested.a': 1, objective: 'kept' },
        fr: { 'obj.title': 'Bonjour' },
      };
    });

    it('removes the subfields, enabling validation', () => {
      removeObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object' },
      });

      expect(draft.currentValues.en).toEqual({ objective: 'kept', obj: null });
      expect(draft.currentValues.fr).toEqual({ 'obj.title': 'Bonjour' });
    });

    it('removes them from every locale with the duplicate strategy', () => {
      removeObjectFields({
        draft,
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object', i18n: 'duplicate' },
      });

      expect(draft.currentValues.fr).toEqual({ obj: null });
    });

    it('removes them from another value store', () => {
      draft.extraValues.en = { 'obj.title': 'Hello' };

      removeObjectFields({
        draft,
        valueStoreKey: 'extraValues',
        locale: 'en',
        keyPath: 'obj',
        fieldConfig: { name: 'obj', widget: 'object' },
      });

      expect(draft.extraValues.en).toEqual({ obj: null });
      expect(draft.currentValues.en['obj.title']).toBe('Hello');
    });
  });
});
