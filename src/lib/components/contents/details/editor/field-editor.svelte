<script>
  import { _ } from '@sveltia/i18n';
  import { Menu, MenuButton, MenuItem, Spacer } from '@sveltia/ui';
  import { escapeRegExp } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import { sanitize } from 'isomorphic-dompurify';
  import { parseInline } from 'marked';
  import { getContext, setContext } from 'svelte';
  import { writable } from 'svelte/store';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { editors } from '$lib/components/contents/details/fields';
  import { entryDraft, INTERNAL_PROP_REGEX } from '$lib/services/contents/draft';
  import {
    resolveOriginalKeyPath,
    revertChanges,
  } from '$lib/services/contents/draft/update/revert';
  import { isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

  /**
   * @import { Component } from 'svelte';
   * @import { Writable } from 'svelte/store';
   * @import {
   * DraftValueStoreKey,
   * FieldContext,
   * FieldEditorContext,
   * InternalLocaleCode,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import {
   * BooleanField,
   * Field,
   * FieldKeyPath,
   * NumberField,
   * StringField,
   * VisibleField,
   * } from '$lib/types/public';
   */

  /** @type {FieldEditorContext} */
  const parent = getContext('field-editor') ?? {};

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {TypedFieldKeyPath} typedKeyPath Typed field key path.
   * @property {Field} fieldConfig Field configuration.
   * @property {FieldContext} [context] Where the field is rendered.
   * @property {DraftValueStoreKey} [valueStoreKey] Key to store the values in {@link EntryDraft}.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    context: fieldContext = parent.fieldContext ?? undefined,
    valueStoreKey = parent.valueStoreKey ?? 'currentValues',
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /**
   * Parse the given string as Markdown and sanitize the result to only allow certain tags.
   * @param {string} str Original string.
   * @returns {string} Sanitized string.
   */
  const _sanitize = (str) =>
    sanitize(/** @type {string} */ (parseInline(str.replaceAll('\\n', '<br>'))), {
      ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
    });

  /** @type {Writable<Component>} */
  const extraHint = writable();

  setContext(
    'field-editor',
    // svelte-ignore state_referenced_locally
    /** @type {FieldEditorContext} */ ({ fieldContext, extraHint, valueStoreKey }),
  );

  const inEditorComponent = $derived(fieldContext === 'rich-text-editor-component');
  const { name: fieldName, widget: fieldType = 'string', i18n = false } = $derived(fieldConfig);
  const {
    label = '',
    comment = '',
    hint = '',
    readonly: readonlyOption = false,
  } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const required = $derived(isFieldRequired({ fieldConfig, locale }));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const allowPrefix = $derived(['string'].includes(fieldType));
  const prefix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).prefix : undefined,
  );
  const suffix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).suffix : undefined,
  );
  const allowExtraLabels = $derived(['boolean', 'number', 'string'].includes(fieldType));
  const beforeInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).before_input
      : undefined,
  );
  const afterInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).after_input
      : undefined,
  );
  const hasExtraLabels = $derived(!!(prefix || suffix || beforeInputLabel || afterInputLabel));
  const isList = $derived(fieldType === 'list' || multiple);
  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalValues = $derived($entryDraft?.originalValues);
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const otherLocales = $derived(i18nEnabled ? allLocales.filter((l) => l !== locale) : []);
  const canTranslate = $derived(i18nEnabled && (i18n === true || i18n === 'translate'));
  const canDuplicate = $derived(i18nEnabled && i18n === 'duplicate');
  const canEdit = $derived(
    inEditorComponent || locale === defaultLocale || canTranslate || canDuplicate,
  );
  const canCopy = $derived(!inEditorComponent && canTranslate && otherLocales.length);
  const canRevert = $derived(!inEditorComponent && !(canDuplicate && locale !== defaultLocale));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`));
  const currentValue = $derived.by(() => {
    const valueMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
    const value = valueMap[keyPath];

    if (!isList) {
      return value;
    }

    // Multiple values are flattened in the value map object
    const list = Object.entries(valueMap).filter(([_keyPath]) => keyPathRegex.test(_keyPath));

    if (list.length) {
      return list.map(([, val]) => val).filter((val) => val !== undefined);
    }

    // Convert invalid single value to list. This is in place to handle the case when a field is
    // changed from single to multiple. (Continue to the `$effect` block below.)
    // @todo Move this logic to entry normalization module
    if (multiple && value !== undefined && typeof value !== 'object') {
      return [value];
    }

    return [];
  });
  const originalValue = $derived.by(() => {
    if (isList) {
      return Object.entries(originalValues?.[locale] ?? {})
        .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
        .map(([, val]) => val)
        .filter((val) => val !== undefined);
    }

    // For fields inside list items, use the original key path if the item was reordered
    const currentMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
    const resolved = resolveOriginalKeyPath(currentMap, keyPath);

    if (resolved) {
      return originalValues?.[locale]?.[resolved.originalKeyPath];
    }

    return originalValues?.[locale]?.[keyPath];
  });
  const isRevertDisabled = $derived.by(() => {
    if (fieldType === 'list') {
      // For list fields, compare all flat entries under the keyPath prefix, because `currentValue`
      // and `originalValue` may not capture complex (nested) list items correctly
      const currentMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
      const originalMap = originalValues?.[locale] ?? {};
      const keyPathPrefix = `${keyPath}.`;

      const currentEntries = Object.entries(currentMap)
        .filter(([k]) => k.startsWith(keyPathPrefix) && !INTERNAL_PROP_REGEX.test(k))
        .sort(([a], [b]) => a.localeCompare(b));

      const originalEntries = Object.entries(originalMap)
        .filter(([k]) => k.startsWith(keyPathPrefix) && !INTERNAL_PROP_REGEX.test(k))
        .sort(([a], [b]) => a.localeCompare(b));

      return equal(currentEntries, originalEntries);
    }

    return equal(currentValue, originalValue);
  });
  const validity = $derived($entryDraft?.validities[locale][keyPath]);
  const fieldLabel = $derived(label || fieldName);
  const readonly = $derived(
    readonlyOption ||
      (i18n === 'duplicate' && locale !== defaultLocale) ||
      fieldType === 'compute' ||
      fieldType === 'uuid',
  );
  const invalid = $derived(validity?.valid === false);

  $effect(() => {
    // Convert invalid single value to list. This is in place to handle the case when a field is
    // changed from single to multiple. (Continued from the `currentValue` store above.)
    // @todo Move this logic to entry normalization module
    if ($entryDraft && multiple && Array.isArray(currentValue)) {
      const listItem = $entryDraft[valueStoreKey][locale]?.[`${keyPath}.0`];
      const [value] = currentValue;

      if (listItem === undefined && value !== undefined) {
        $entryDraft[valueStoreKey][locale][`${keyPath}.0`] = value;
        delete $entryDraft[valueStoreKey][locale][keyPath];
      }
    }
  });

  $effect(() => {
    // Convert invalid list to single value. This is in place to handle the case when a field is
    // changed from multiple to single.
    // @todo Move this logic to entry normalization module
    if ($entryDraft && !multiple && currentValue === undefined) {
      const listItem = $entryDraft[valueStoreKey][locale]?.[`${keyPath}.0`];

      if (listItem !== undefined) {
        $entryDraft[valueStoreKey][locale][keyPath] = listItem;
        // Remove all list items
        Object.keys($entryDraft[valueStoreKey][locale]).forEach((key) => {
          if (keyPathRegex.test(key)) {
            delete $entryDraft[valueStoreKey][locale][key];
          }
        });
      }
    }
  });
</script>

{#if $entryDraft && canEdit && fieldType !== 'hidden'}
  <FieldEditorGroup
    aria-label={_('x_field', { values: { field: fieldLabel } })}
    data-field-type={fieldType}
    data-key-path={keyPath}
    data-typed-key-path={typedKeyPath}
    hidden={fieldType === 'compute'}
  >
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{fieldLabel}</h4>
      {#if !readonly && required}
        <div class="required" aria-label={_('required')}>*</div>
      {/if}
      <Spacer flex />
      {#if canCopy && ['richtext', 'markdown', 'string', 'text', 'list', 'object'].includes(fieldType)}
        <TranslateButton size="small" {locale} {otherLocales} {keyPath} />
      {/if}
      {#if canCopy || canRevert}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          popupPosition="bottom-right"
          aria-label={_('show_field_options')}
        >
          {#snippet popup()}
            <Menu aria-label={_('field_options')}>
              {#if canCopy}
                <CopyMenuItems {locale} {otherLocales} {keyPath} />
              {/if}
              {#if canRevert}
                <MenuItem
                  label={_('revert_changes')}
                  disabled={isRevertDisabled}
                  onclick={() => {
                    revertChanges({ locale, keyPath });
                  }}
                />
              {/if}
            </Menu>
          {/snippet}
        </MenuButton>
      {/if}
    </header>
    {#if !readonly && comment}
      <div role="none" class="comment-wrapper">
        <p class="comment">{@html _sanitize(comment)}</p>
      </div>
    {/if}
    {#if validity?.valid === false}
      <ValidationError id="{fieldId}-error">
        {$entryDraft?.validationMessages[locale][keyPath]?.join(' ')}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper" class:has-extra-labels={hasExtraLabels}>
      {#if !(fieldType in editors)}
        <div role="none">{_('unsupported_field_type_x', { values: { name: fieldType } })}</div>
      {:else if isList}
        {@const Editor = editors[fieldType]}
        <Editor
          {locale}
          {keyPath}
          {typedKeyPath}
          {fieldId}
          {fieldLabel}
          {fieldConfig}
          {currentValue}
          {readonly}
          {required}
          {invalid}
        />
      {:else}
        {#if beforeInputLabel}
          <div role="none" class="before-input">{@html _sanitize(beforeInputLabel)}</div>
        {/if}
        {#if prefix}
          <div role="none" class="prefix">{prefix}</div>
        {/if}
        {@const Editor = editors[fieldType]}
        <Editor
          {locale}
          {keyPath}
          {typedKeyPath}
          {fieldId}
          {fieldLabel}
          {fieldConfig}
          bind:currentValue={$entryDraft[valueStoreKey][locale][keyPath]}
          {readonly}
          {required}
          {invalid}
        />
        {#if suffix}
          <div role="none" class="suffix">{suffix}</div>
        {/if}
        {#if afterInputLabel}
          <div role="none" class="after-input">{@html _sanitize(afterInputLabel)}</div>
        {/if}
      {/if}
    </div>
    {#if !readonly && (hint || $extraHint)}
      {@const ExtraHint = $extraHint}
      <div role="none" class="footer">
        {#if hint}
          <p class="hint">{@html _sanitize(hint)}</p>
        {/if}
        <ExtraHint {fieldConfig} {locale} {currentValue} />
      </div>
    {/if}
  </FieldEditorGroup>
{/if}

<style lang="scss">
  .field-wrapper {
    &.has-extra-labels {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
    }

    :global {
      :is(input[type='text'], textarea) {
        width: 100%;
      }

      input:is([type='color'], [type='number']) {
        outline: 0;
        border-width: 1px;
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        height: var(--sui-button-medium-height);
        color: inherit;
        background-color: var(--sui-textbox-background-color);
      }

      input:is([type='file'], [type='checkbox']) {
        color: inherit;
      }

      & > div {
        color: inherit;
      }

      input:is([type='date'], [type='datetime-local'], [type='time']) {
        outline: 0;
        margin: var(--sui-focus-ring-width);
        border-width: var(--sui-textbox-border-width, 1px);
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        padding: var(--sui-textbox-singleline-padding);
        width: auto;
        height: var(--sui-textbox-height);
        color: var(--sui-textbox-foreground-color);
        background-color: var(--sui-textbox-background-color);
        font-family: var(--sui-textbox-font-family);
        font-size: var(--sui-textbox-font-size);
        text-transform: uppercase;

        &:disabled {
          opacity: 0.4;
        }
      }

      input[aria-invalid='true']:is(
          [type='color'],
          [type='date'],
          [type='datetime-local'],
          [type='time']
        ) {
        border-color: var(--sui-error-border-color);
      }

      input:read-only {
        // Make readonly inputs selectable
        -webkit-user-select: text;
        user-select: text;
        pointer-events: auto;
      }
    }
  }

  .before-input,
  .after-input,
  .prefix,
  .suffix {
    color: var(--sui-secondary-foreground-color);
    white-space: nowrap;
  }

  .comment,
  .hint {
    margin-inline: var(--sui-focus-ring-width) !important;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
  }

  .comment {
    margin-block: var(--sui-focus-ring-width) !important;
  }

  .hint {
    flex: auto;
    margin-block: var(--sui-focus-ring-width) 0 !important;
    color: var(--sui-tertiary-foreground-color);
  }

  .footer {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 4px;
  }
</style>
