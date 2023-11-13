<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem, Spacer, getRandomId } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { marked } from 'marked';
  import { _ } from 'svelte-i18n';
  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import { editors } from '$lib/components/contents/details/widgets';
  import { entryDraft, revertChanges } from '$lib/services/contents/editor';
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
  $: hasMultiple = ['relation', 'select'].includes(widgetName);
  $: multiple = hasMultiple
    ? /** @type {RelationField | SelectField} */ (fieldConfig).multiple
    : undefined;
  $: isList = widgetName === 'list' || (hasMultiple && multiple);
  $: ({
    hasLocales = false,
    locales = ['default'],
    defaultLocale = 'default',
  } = $entryDraft.collection._i18n ?? /** @type {I18nConfig} */ ({}));
  $: otherLocales = hasLocales ? locales.filter((l) => l !== locale) : [];
  $: canTranslate = hasLocales && (i18n === true || i18n === 'translate');
  $: canDuplicate = hasLocales && i18n === 'duplicate';
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

  // Multiple values are flattened in the value map object
  $: currentValue = isList
    ? Object.entries($entryDraft.currentValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : $entryDraft.currentValues[locale][keyPath];
  $: originalValue = isList
    ? Object.entries($entryDraft.originalValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : $entryDraft.originalValues[locale][keyPath];
  $: validity = $entryDraft.validities[locale][keyPath];

  $: fieldLabel = label || fieldName;
  $: readonly = i18n === 'duplicate' && locale !== defaultLocale;
  $: invalid = validity?.valid === false;
</script>

{#if widgetName !== 'hidden' && (locale === defaultLocale || canTranslate || canDuplicate)}
  {@const canCopy = canTranslate && otherLocales.length}
  {@const canRevert = !(canDuplicate && locale !== defaultLocale)}
  <section
    role="group"
    aria-labelledby="{fieldId}-label"
    data-widget={widgetName}
    data-key-path={keyPath}
  >
    <header>
      <h4 id="{fieldId}-label">{fieldLabel}</h4>
      {#if !readonly && required}
        <div class="required">{$_('required')}</div>
      {/if}
      <Spacer flex />
      {#if canCopy || canRevert}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          popupPosition="bottom-right"
          aria-label={$_('show_menu_x_field', { values: { field: fieldLabel } })}
        >
          <Icon slot="start-icon" name="more_vert" />
          <Menu slot="popup">
            {#if canCopy}
              {#if ['markdown', 'string', 'text', 'list', 'object'].includes(widgetName)}
                <CopyMenuItems {keyPath} {locale} translate={true} />
                {#if otherLocales.length > 1}
                  <Divider />
                {/if}
              {/if}
              <CopyMenuItems {keyPath} {locale} />
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
    <div id="{fieldId}-error" class="validation" aria-live="assertive">
      {#if validity?.valid === false}
        {#if validity.valueMissing}
          <div>
            <Icon name="error" />
            {$_('validation.value_missing')}
          </div>
        {/if}
        {#if validity.rangeUnderflow}
          <div>
            <Icon name="error" label={$_('error')} />
            {#if (widgetName === 'list' && hasSubFields) || multiple}
              {$_(`validation.range_underflow.add_${min === 1 ? 'singular' : 'plural'}`, {
                values: { min },
              })}
            {:else}
              {$_(`validation.range_underflow.select_${min === 1 ? 'singular' : 'plural'}`, {
                values: { min },
              })}
            {/if}
          </div>
        {/if}
        {#if validity.rangeOverflow}
          <div>
            <Icon name="error" label={$_('error')} />
            {#if (widgetName === 'list' && hasSubFields) || multiple}
              {$_(`validation.range_overflow.add_${max === 1 ? 'singular' : 'plural'}`, {
                values: { max },
              })}
            {:else}
              {$_(`validation.range_overflow.select_${max === 1 ? 'singular' : 'plural'}`, {
                values: { max },
              })}
            {/if}
          </div>
        {/if}
        {#if validity.patternMismatch}
          <div>
            <Icon name="error" label={$_('error')} />
            {pattern?.[1] ?? ''}
          </div>
        {/if}
      {/if}
    </div>
    <div>
      {#if !(widgetName in editors)}
        <div>{$_('unsupported_widget_x', { values: { name: widgetName } })}</div>
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
      {/if}
    </div>
    {#if !readonly && hint}
      <div class="hint">{@html marked.parse(hint)}</div>
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
      border: 1px solid var(--sui-control-border-color);
      border-radius: 4px;
      padding: 2px 4px;
      color: var(--sui-info-foreground-color);
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

      :global(:root[data-theme='dark']) & {
        :global(input[type='date']::-webkit-calendar-picker-indicator),
        :global(input[type='datetime-local']::-webkit-calendar-picker-indicator),
        :global(input[type='time']::-webkit-calendar-picker-indicator) {
          filter: invert(1);
        }
      }
    }
  }

  .validation {
    color: var(--sui-error-foreground-color);

    div {
      display: flex;
      gap: 4px;
      margin: 8px 0;

      :global(.icon) {
        flex: none;
        font-size: 20px; /* !hardcoded */
      }
    }
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
