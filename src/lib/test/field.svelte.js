import { render } from 'vitest-browser-svelte';

import { renderWithDraft } from '$lib/test/draft';

/**
 * @import { Component } from 'svelte';
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * @typedef {{
 * locale: InternalLocaleCode,
 * keyPath: string,
 * typedKeyPath: string,
 * fieldConfig: any,
 * currentValue: any,
 * } & Record<string, any>} FieldProps
 */

/**
 * @typedef {Awaited<ReturnType<typeof render>> & { entryDraft?: EntryDraftState }} RenderResult
 */

/**
 * @typedef {object} RenderFieldOptions
 * @property {any} [currentValue] Field value.
 * @property {InternalLocaleCode} [locale] Locale. Defaults to `en`.
 * @property {string} [keyPath] Key path. Defaults to the field name.
 * @property {string} [typedKeyPath] Typed key path. Defaults to the key path.
 * @property {Record<string, any>} [props] Any other component prop, e.g. `required` or
 * `readonly`, which overrides the ones above.
 * @property {EntryDraft} [draft] Entry draft, usually from `createMockDraft()`. When given, the
 * component is rendered with the draft in its context.
 * @property {Record<string, any> | Map<string, any>} [context] Any other Svelte context, keyed by
 * context key, e.g. the `field-editor` context a field editor gets from its parent.
 */

/**
 * Render a field editor or preview with the given props.
 * @param {Component<any>} Component Component.
 * @param {FieldProps} props Props, as a `$state`.
 * @param {object} options Options.
 * @param {EntryDraft} [options.draft] Entry draft.
 * @param {Record<string, any> | Map<string, any>} [options.context] Svelte context.
 * @returns {Promise<RenderResult>} Render result, along with the draft state if a draft is given.
 */
const renderField = async (Component, props, { draft, context }) => {
  if (draft) {
    return renderWithDraft(Component, {
      draft,
      props,
      context: context instanceof Map ? Object.fromEntries(context) : context,
    });
  }

  if (context) {
    return render(Component, {
      props,
      context: context instanceof Map ? context : new Map(Object.entries(context)),
    });
  }

  return render(Component, props);
};

/**
 * Render a field editor, with the props the app’s `FieldEditor` passes it.
 * @param {Component<any>} Component Editor component.
 * @param {RenderFieldOptions & {
 * fieldConfig: Field | Record<string, any>,
 * fieldId?: string,
 * fieldLabel?: string,
 * }} options Options. `fieldId` defaults to the key path, and `fieldLabel` to the field’s `label`
 * or `name`.
 * @returns {Promise<RenderResult & { props: FieldProps }>} Render result along with the props, a
 * `$state` whose `currentValue` follows the editor and can be changed to test a new value.
 */
export const renderFieldEditor = async (
  Component,
  {
    fieldConfig,
    currentValue = undefined,
    locale = 'en',
    keyPath = fieldConfig.name,
    typedKeyPath = keyPath,
    fieldId = keyPath,
    fieldLabel = fieldConfig.label ?? fieldConfig.name,
    props: otherProps = {},
    draft = undefined,
    context = undefined,
  },
) => {
  const props = $state({
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue,
    ...otherProps,
  });

  return { props, ...(await renderField(Component, props, { draft, context })) };
};

/**
 * Render a field preview, with the props the app’s `FieldPreview` passes it.
 * @param {Component<any>} Component Preview component.
 * @param {RenderFieldOptions & { fieldConfig: Field | Record<string, any> }} options Options.
 * @returns {Promise<RenderResult & { props: FieldProps }>} Render result along with the props, a
 * `$state` that can be changed to test a new value.
 */
export const renderFieldPreview = async (
  Component,
  {
    fieldConfig,
    currentValue = undefined,
    locale = 'en',
    keyPath = fieldConfig.name,
    typedKeyPath = keyPath,
    props: otherProps = {},
    draft = undefined,
    context = undefined,
  },
) => {
  const props = $state({ locale, keyPath, typedKeyPath, fieldConfig, currentValue, ...otherProps });

  return { props, ...(await renderField(Component, props, { draft, context })) };
};
