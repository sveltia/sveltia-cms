<script>
  import { Menu, MenuButton, MenuItem, Spacer } from '@sveltia/ui';
  import { escapeRegExp } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import { getContext, setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { _ } from 'svelte-i18n';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { editors } from '$lib/components/contents/details/widgets';
  import { entryDraft } from '$lib/services/contents/draft';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { MIN_MAX_VALUE_WIDGETS } from '$lib/services/contents/widgets';
  import { getListFieldInfo } from '$lib/services/contents/widgets/list/helper';

  /**
   * @import { Component } from 'svelte';
   * @import { Writable } from 'svelte/store';
   * @import {
   * DraftValueStoreKey,
   * FieldEditorContext,
   * InternalLocaleCode,
   * WidgetContext,
   * } from '$lib/types/private';
   * @import {
   * BooleanField,
   * Field,
   * FieldKeyPath,
   * ListField,
   * MinMaxValueField,
   * NumberField,
   * StringField,
   * TextField,
   * } from '$lib/types/public';
   */

  /** @type {FieldEditorContext} */
  const parent = getContext('field-editor') ?? {};

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {Field} fieldConfig Field configuration.
   * @property {WidgetContext} [context] Where the widget is rendered.
   * @property {DraftValueStoreKey} [valueStoreKey] Key to store the values in {@link EntryDraft}.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    context: widgetContext = parent.widgetContext ?? undefined,
    valueStoreKey = parent.valueStoreKey ?? 'currentValues',
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /**
   * Parse the given string as Markdown and sanitize the result to only allow certain tags.
   * @param {string} str Original string.
   * @returns {string} Sanitized string.
   */
  const sanitize = (str) =>
    DOMPurify.sanitize(/** @type {string} */ (marked.parseInline(str.replaceAll('\\n', '<br>'))), {
      ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
    });

  /** @type {Writable<Component>} */
  const extraHint = writable();

  setContext(
    'field-editor',
    /** @type {FieldEditorContext} */ ({ widgetContext, extraHint, valueStoreKey }),
  );

  const inEditorComponent = $derived(widgetContext === 'markdown-editor-component');
  const {
    name: fieldName,
    label = '',
    comment = '',
    hint = '',
    widget: widgetName = 'string',
    i18n = false,
    pattern = /** @type {string[]} */ ([]),
    readonly: readonlyOption = false,
  } = $derived(fieldConfig);
  const required = $derived(isFieldRequired({ fieldConfig, locale }));
  const { hasSubFields } = $derived(
    widgetName === 'list'
      ? getListFieldInfo(/** @type {ListField} */ (fieldConfig))
      : { hasSubFields: false },
  );
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const { min = 0, max = Infinity } = $derived(
    /** @type {MinMaxValueField} */ (MIN_MAX_VALUE_WIDGETS.includes(widgetName) ? fieldConfig : {}),
  );
  const type = $derived(
    // prettier-ignore
    widgetName === 'string'
      ? /** @type {StringField} */ (fieldConfig).type ?? 'text'
      : widgetName === 'number'
        ? 'number'
        : undefined,
  );
  const allowPrefix = $derived(['string'].includes(widgetName));
  const prefix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).prefix : undefined,
  );
  const suffix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).suffix : undefined,
  );
  const allowExtraLabels = $derived(['boolean', 'number', 'string'].includes(widgetName));
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
  const canAddMultiValue = $derived(
    (widgetName === 'list' && hasSubFields) || multiple || widgetName === 'keyvalue',
  );
  const isList = $derived(widgetName === 'list' || multiple);
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
  const originalValue = $derived(
    isList
      ? Object.entries(originalValues?.[locale] ?? {})
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([, val]) => val)
          .filter((val) => val !== undefined)
      : originalValues?.[locale]?.[keyPath],
  );
  const validity = $derived($entryDraft?.validities[locale][keyPath]);
  const fieldLabel = $derived(label || fieldName);
  const readonly = $derived(
    readonlyOption ||
      (i18n === 'duplicate' && locale !== defaultLocale) ||
      widgetName === 'compute' ||
      widgetName === 'uuid',
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

{#if $entryDraft && canEdit && widgetName !== 'hidden'}
  <FieldEditorGroup
    aria-label={$_('x_field', { values: { field: fieldLabel } })}
    data-widget={widgetName}
    data-key-path={keyPath}
    hidden={widgetName === 'compute'}
  >
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{fieldLabel}</h4>
      {#if !readonly && required}
        <div class="required" aria-label={$_('required')}>*</div>
      {/if}
      <Spacer flex />
      {#if canCopy && ['markdown', 'string', 'text', 'list', 'object'].includes(widgetName)}
        <TranslateButton size="small" {locale} {otherLocales} {keyPath} />
      {/if}
      {#if canCopy || canRevert}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          popupPosition="bottom-right"
          aria-label={$_('show_field_options')}
        >
          {#snippet popup()}
            <Menu aria-label={$_('field_options')}>
              {#if canCopy}
                <CopyMenuItems {locale} {otherLocales} {keyPath} />
              {/if}
              {#if canRevert}
                <MenuItem
                  label={$_('revert_changes')}
                  disabled={equal(currentValue, originalValue) ||
                    // Disable reversion in list items until we figure out how to handle reordering
                    /\.\d+\./.test(keyPath)}
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
      <p class="comment">{@html sanitize(comment)}</p>
    {/if}
    {#if validity?.valid === false}
      <ValidationError id="{fieldId}-error">
        {#if validity.valueMissing}
          {$_('validation.value_missing')}
        {/if}
        {#if validity.tooShort}
          {@const { minlength } = (() => /** @type {StringField | TextField} */ (fieldConfig))()}
          {$_(minlength === 1 ? 'validation.too_short.one' : 'validation.too_short.many', {
            values: { min: minlength },
          })}
        {/if}
        {#if validity.tooLong}
          {@const { maxlength } = (() => /** @type {StringField | TextField} */ (fieldConfig))()}
          {$_(maxlength === 1 ? 'validation.too_long.one' : 'validation.too_long.many', {
            values: { max: maxlength },
          })}
        {/if}
        {#if validity.rangeUnderflow}
          {@const quantity = min === 1 ? 'one' : 'many'}
          {#if widgetName === 'number'}
            {$_('validation.range_underflow.number', { values: { min } })}
          {:else if canAddMultiValue}
            {$_(`validation.range_underflow.add_${quantity}`, { values: { min } })}
          {:else}
            {$_(`validation.range_underflow.select_${quantity}`, { values: { min } })}
          {/if}
        {/if}
        {#if validity.rangeOverflow}
          {@const quantity = max === 1 ? 'one' : 'many'}
          {#if widgetName === 'number'}
            {$_('validation.range_overflow.number', { values: { max } })}
          {:else if canAddMultiValue}
            {$_(`validation.range_overflow.add_${quantity}`, { values: { max } })}
          {:else}
            {$_(`validation.range_overflow.select_${quantity}`, { values: { max } })}
          {/if}
        {/if}
        {#if validity.patternMismatch}
          {pattern[1]}
        {/if}
        {#if validity.typeMismatch}
          {$_(`validation.type_mismatch.${type}`)}
        {/if}
      </ValidationError>
    {/if}
    <div role="none" class="widget-wrapper" class:has-extra-labels={hasExtraLabels}>
      {#if !(widgetName in editors)}
        <div role="none">{$_('unsupported_widget_x', { values: { name: widgetName } })}</div>
      {:else if isList}
        {@const Editor = editors[widgetName]}
        <Editor
          {locale}
          {keyPath}
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
          <div role="none" class="before-input">{@html sanitize(beforeInputLabel)}</div>
        {/if}
        {#if prefix}
          <div role="none" class="prefix">{prefix}</div>
        {/if}
        {@const Editor = editors[widgetName]}
        <Editor
          {locale}
          {keyPath}
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
          <div role="none" class="after-input">{@html sanitize(afterInputLabel)}</div>
        {/if}
      {/if}
    </div>
    {#if !readonly && (hint || $extraHint)}
      {@const ExtraHint = $extraHint}
      <div role="none" class="footer">
        {#if hint}
          <p class="hint">{@html sanitize(hint)}</p>
        {/if}
        <ExtraHint {fieldConfig} {currentValue} />
      </div>
    {/if}
  </FieldEditorGroup>
{/if}

<style lang="scss">
  .widget-wrapper {
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

  .comment {
    margin-block: 4px;
    line-height: var(--sui-line-height-compact);
  }

  .footer {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .hint {
    flex: auto;
    margin: 0;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
    opacity: 0.75;
  }
</style>
