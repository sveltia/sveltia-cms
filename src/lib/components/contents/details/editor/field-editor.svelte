<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem, Spacer, getRandomId } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { marked } from 'marked';
  import { _ } from 'svelte-i18n';
  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import { editors } from '$lib/components/contents/details/widgets';
  import { entryDraft, revertChanges } from '$lib/services/contents/editor';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';
  import { escapeRegExp } from '$lib/services/utils/strings';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {Field}
   */
  export let fieldConfig;

  const fieldId = getRandomId('field');

  /** @type {MenuButton} */
  let menuButton;

  // @todo Save & restore draft from local storage.

  $: ({
    name: fieldName,
    label = '',
    hint = '',
    widget: widgetName = 'string',
    required = true,
    i18n = false,
    pattern = /** @type {string[]} */ ([]),
  } = fieldConfig);
  // @ts-ignore
  $: ({ field: subField, fields: subFields, types } = /** @type {ListField} */ (fieldConfig));
  $: hasSubFields = !!subField || !!subFields || !!types;
  // @ts-ignore
  $: ({ min, max } = /** @type {ListField | NumberField | RelationField | SelectField} */ (
    fieldConfig
  ));
  $: type =
    widgetName === 'string' ? /** @type {StringField} */ (fieldConfig).type ?? 'text' : undefined;
  $: allowPrefix = ['string'].includes(widgetName);
  $: prefix = allowPrefix ? /** @type {StringField} */ (fieldConfig).prefix : undefined;
  $: suffix = allowPrefix ? /** @type {StringField} */ (fieldConfig).suffix : undefined;
  $: allowExtraLabels = ['boolean', 'number', 'string'].includes(widgetName);
  $: beforeInputLabel = allowExtraLabels
    ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).before_input
    : undefined;
  $: afterInputLabel = allowExtraLabels
    ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).after_input
    : undefined;
  $: hasExtraLabels = !!(prefix || suffix || beforeInputLabel || afterInputLabel);
  $: hasMultiple = ['relation', 'select'].includes(widgetName);
  $: multiple = hasMultiple
    ? /** @type {RelationField | SelectField} */ (fieldConfig).multiple
    : undefined;
  $: isList = widgetName === 'list' || (hasMultiple && multiple);
  $: ({ collection, collectionFile, originalValues, currentValues, validities } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ i18nEnabled, locales, defaultLocale } =
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: otherLocales = i18nEnabled ? locales.filter((l) => l !== locale) : [];
  $: canTranslate = i18nEnabled && (i18n === true || i18n === 'translate');
  $: canDuplicate = i18nEnabled && i18n === 'duplicate';
  $: canEdit = locale === defaultLocale || canTranslate || canDuplicate;
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

  // Multiple values are flattened in the value map object
  $: currentValue = isList
    ? Object.entries(currentValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : currentValues[locale][keyPath];
  $: originalValue = isList
    ? Object.entries(originalValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : originalValues[locale][keyPath];
  $: validity = validities[locale][keyPath];

  $: fieldLabel = label || fieldName;
  $: readonly = (i18n === 'duplicate' && locale !== defaultLocale) || widgetName === 'compute';
  $: invalid = validity?.valid === false;
</script>

{#if $entryDraft && canEdit && widgetName !== 'hidden'}
  {@const canCopy = canTranslate && otherLocales.length}
  {@const canRevert = !(canDuplicate && locale !== defaultLocale)}
  <section
    role="group"
    aria-label={$_('x_field', { values: { field: fieldLabel } })}
    data-widget={widgetName}
    data-key-path={keyPath}
  >
    <header role="none">
      {#if !readonly && required}
        <div class="required" aria-hidden="true">{$_('required')}</div>
      {/if}
      <h4 role="none" id="{fieldId}-label">{fieldLabel}</h4>
      <Spacer flex />
      {#if canCopy || canRevert}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          popupPosition="bottom-right"
          aria-label={$_('show_field_options')}
          bind:this={menuButton}
        >
          <Icon slot="start-icon" name="more_vert" />
          <Menu slot="popup" aria-label={$_('field_options')}>
            {#if canCopy}
              {#if ['markdown', 'string', 'text', 'list', 'object'].includes(widgetName)}
                <CopyMenuItems anchor={menuButton} {keyPath} {locale} translate={true} />
                {#if otherLocales.length > 1}
                  <Divider />
                {/if}
              {/if}
              <CopyMenuItems anchor={menuButton} {keyPath} {locale} />
            {/if}
            {#if canCopy && canRevert}
              <Divider />
            {/if}
            {#if canRevert}
              <MenuItem
                label={$_('revert_changes')}
                disabled={equal(currentValue, originalValue)}
                on:click={() => {
                  revertChanges(locale, keyPath);
                }}
              />
            {/if}
          </Menu>
        </MenuButton>
      {/if}
    </header>
    <div role="alert" id="{fieldId}-error" class="validation" aria-live="polite">
      {#if validity?.valid === false}
        {#if validity.valueMissing}
          <div role="none">
            <Icon name="error" />
            {$_('validation.value_missing')}
          </div>
        {/if}
        {#if validity.rangeUnderflow}
          <div role="none">
            <Icon name="error" />
            {#if (widgetName === 'list' && hasSubFields) || multiple}
              {$_(`validation.range_underflow.add_${min === 1 ? 'one' : 'many'}`, {
                values: { min },
              })}
            {:else}
              {$_(`validation.range_underflow.select_${min === 1 ? 'one' : 'many'}`, {
                values: { min },
              })}
            {/if}
          </div>
        {/if}
        {#if validity.rangeOverflow}
          <div role="none">
            <Icon name="error" />
            {#if (widgetName === 'list' && hasSubFields) || multiple}
              {$_(`validation.range_overflow.add_${max === 1 ? 'one' : 'many'}`, {
                values: { max },
              })}
            {:else}
              {$_(`validation.range_overflow.select_${max === 1 ? 'one' : 'many'}`, {
                values: { max },
              })}
            {/if}
          </div>
        {/if}
        {#if validity.patternMismatch}
          <div role="none">
            <Icon name="error" />
            {pattern?.[1] ?? ''}
          </div>
        {/if}
        {#if validity.typeMismatch}
          <div role="none">
            <Icon name="error" />
            {$_(`validation.type_mismatch.${type}`)}
          </div>
        {/if}
      {/if}
    </div>
    <div role="none" class="widget-wrapper" class:has-extra-labels={hasExtraLabels}>
      {#if !(widgetName in editors)}
        <div role="none">{$_('unsupported_widget_x', { values: { name: widgetName } })}</div>
      {:else if isList}
        <svelte:component
          this={editors[widgetName]}
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
          <div role="none" class="before-input">{@html marked.parse(beforeInputLabel)}</div>
        {/if}
        {#if prefix}
          <div role="none" class="prefix">{prefix}</div>
        {/if}
        <svelte:component
          this={editors[widgetName]}
          {locale}
          {keyPath}
          {fieldId}
          {fieldLabel}
          {fieldConfig}
          bind:currentValue={$entryDraft.currentValues[locale][keyPath]}
          {readonly}
          {required}
          {invalid}
        />
        {#if suffix}
          <div role="none" class="suffix">{suffix}</div>
        {/if}
        {#if afterInputLabel}
          <div role="none" class="after-input">{@html marked.parse(afterInputLabel)}</div>
        {/if}
      {/if}
    </div>
    {#if !readonly && hint}
      <div role="none" class="hint">{@html marked.parse(hint)}</div>
    {/if}
  </section>
{/if}

<style lang="scss">
  section {
    padding: 16px;

    &:not(:last-child) {
      border-width: 0 0 1px;
      border-color: var(--sui-secondary-border-color);
    }

    & > * {
      margin-right: auto;
      margin-left: auto;
      max-width: 768px;
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    h4 {
      font-size: var(--sui-font-size-small);
      font-weight: 600;
      color: var(--sui-secondary-foreground-color);
    }

    .required {
      border: 1px solid var(--sui-error-border-color);
      border-radius: 4px;
      padding: 2px 4px;
      color: var(--sui-error-foreground-color);
      background-color: var(--sui-error-background-color);
      font-size: var(--sui-font-size-x-small);
    }

    & + div {
      :global(input[type='color']),
      :global(input[type='date']),
      :global(input[type='datetime-local']),
      :global(input[type='time']),
      :global(input[type='number']) {
        outline: 0;
        border: 0;
        color: inherit;
      }

      :global(input[type='text']),
      :global(textarea) {
        width: 100%;
      }

      :global(input[type='color']),
      :global(input[type='number']) {
        background-color: var(--sui-textbox-background-color);
        border-width: 1px;
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
      }

      :global(input[type='file']),
      :global(input[type='checkbox']),
      & > :global(div) {
        color: inherit;
      }

      :global(input[type='date']),
      :global(input[type='datetime-local']),
      :global(input[type='time']) {
        width: auto;
        text-transform: uppercase;
        background-color: transparent;
      }
    }
  }

  .validation {
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);

    div {
      display: flex;
      gap: 4px;
      margin: 4px 0;

      :global(.icon) {
        flex: none;
        font-size: 16px; /* !hardcoded */
      }
    }
  }

  .widget-wrapper.has-extra-labels {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
  }

  .before-input,
  .after-input,
  .prefix,
  .suffix {
    color: var(--sui-secondary-foreground-color);
    white-space: nowrap;
  }

  .hint {
    margin-top: 8px;
    font-size: var(--sui-font-size-small);
    opacity: 0.75;

    :global(p) {
      margin: 0;
    }
  }
</style>
