<!--
  @component
  Implement the editor for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { Button, Icon, Option, Select } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';
  import { _ } from 'svelte-i18n';
  import { entryDraft, updateListField } from '$lib/services/contents/editor';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {SelectField}
   */
  export let fieldConfig;
  /**
   * @type {any} // string | string[]
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let sortOptions = false;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  /**
   * @type {string | undefined}
   */
  let selectValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    options: fieldOptions,
    multiple,
    // min,
    max,
  } = fieldConfig);

  /**
   * @type {{ label: string, value: string, searchValue?: string }[]}
   */
  $: options = (() => {
    const _options =
      /** @type {{ label: string, value: string, searchValue?: string }[] | string[]} */ (
        fieldOptions
      ).map((option) =>
        isObject(option) ? /** @type {any} */ (option) : { label: option, value: option },
      );

    if (sortOptions) {
      _options.sort((a, b) => a.label.localeCompare(b.label));
    }

    return _options;
  })();

  /**
   * Update the value for the list.
   * @param {(arg: { valueList: any[], expanderStateList: any[] }) => void} manipulate -
   * See {@link updateListField}.
   */
  const updateList = (manipulate) => {
    Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
      if (!(i18n !== 'duplicate' && _locale !== locale)) {
        updateListField(_locale, keyPath, manipulate);
      }
    });
  };

  /**
   * Add a value to the list.
   * @param {string} value - New value.
   */
  const addValue = (value) => {
    updateList(({ valueList }) => {
      valueList.push(value);
    });
  };

  /**
   * Remove a value from the list.
   * @param {number} index - Target index.
   */
  const removeValue = (index) => {
    updateList(({ valueList }) => {
      valueList.splice(index, 1);
    });
  };
</script>

{#if multiple}
  <div role="none" class="multi-selector" class:disabled={readonly}>
    {#each currentValue as value, index}
      {@const option = options.find((o) => o.value === value)}
      {#if option}
        <span role="none">
          {option.label}
          <Button
            iconic
            size="small"
            disabled={readonly}
            aria-label={$_('remove_x', { values: { name: option.label } })}
            on:click={() => {
              removeValue(index);
            }}
          >
            <Icon slot="start-icon" name="close" />
          </Button>
        </span>
      {/if}
    {/each}
    {#if (typeof max !== 'number' || currentValue.length < max) && currentValue.length < options.length}
      <Select
        disabled={readonly}
        {readonly}
        {required}
        {invalid}
        bind:value={selectValue}
        on:change={() => {
          // Avoid an error while navigating pages
          if ($entryDraft && selectValue) {
            addValue(selectValue);
            // Reset the combobox
            selectValue = undefined;
          }
        }}
      >
        {#each options as { label, value, searchValue } (value)}
          {#if !currentValue.includes(value)}
            <Option {label} {value} {searchValue} />
          {/if}
        {/each}
      </Select>
    {/if}
  </div>
{:else}
  <Select
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  >
    {#each options as { label, value, searchValue } (value)}
      <Option {label} {value} {searchValue} selected={value === currentValue} />
    {/each}
  </Select>
{/if}

<style lang="scss">
  .multi-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;

    &.disabled {
      pointer-events: none;

      & > * {
        opacity: 0.5;
      }
    }

    span {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 0 0 8px;
      border-radius: var(--sui-control-medium-border-radius);
      background-color: var(--sui-secondary-background-color);

      :global(.icon) {
        font-size: var(--sui-font-size-large);
      }
    }
  }
</style>
