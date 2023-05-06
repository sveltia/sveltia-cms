<!--
  @component
  Implement the editor for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { Button, Combobox, Icon, Option, Select } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { defaultContentLocale } from '$lib/services/config';
  import { entryDraft, updateListField } from '$lib/services/contents/editor';
  import { isObject } from '$lib/services/utils/misc';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;
  export let options = undefined;

  $: ({
    i18n,
    // Widget-specific options
    options: fieldOptions,
    multiple,
    // min,
    max,
  } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;

  $: sortedOptions = (
    options ||
    fieldOptions.map((option) => ({
      label: isObject(option) ? option.label : option,
      value: isObject(option) ? option.value : option,
    }))
  ).sort((a, b) => a.label.localeCompare(b.label));

  /**
   * Update the value for the list.
   * @param {Function} manipulate A function to manipulate the list, which takes one argument of the
   * list itself. The typical usage is `list.splice()`.
   */
  const updateList = (manipulate) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (!(i18n !== 'duplicate' && _locale !== locale)) {
        updateListField(_locale, keyPath, manipulate);
      }
    });
  };

  /**
   * Add a value to the list.
   * @param {string} value New value.
   */
  const addValue = (value) => {
    updateList((list) => {
      list.push(value);
    });
  };

  /**
   * Remove a value from the list.
   * @param {number} index Target index.
   */
  const removeValue = (index) => {
    updateList((list) => {
      list.splice(index, 1);
    });
  };
</script>

{#if multiple}
  <div class="multi-selector" class:disabled>
    {#each sortedOptions as { label, value } (value)}
      {@const index = currentValue.indexOf(value)}
      {#if index > -1}
        <span>
          {label}
          <Button
            {disabled}
            on:click={() => {
              removeValue(index);
            }}
          >
            <Icon slot="start-icon" name="close" label={$_('delete')} />
          </Button>
        </span>
      {/if}
    {/each}
    {#if (!max || currentValue.length < max) && currentValue.length < sortedOptions.length}
      <Combobox
        {disabled}
        on:change={({ detail: { target, value } }) => {
          // Avoid an error while navigating pages
          if (!$entryDraft) {
            return;
          }

          addValue(value);

          // Make the textbox empty
          window.requestAnimationFrame(() => {
            target.value = '';
          });
        }}
      >
        {#each sortedOptions as { label, value } (value)}
          {#if !currentValue.includes(value)}
            <Option {label} {value} />
          {/if}
        {/each}
      </Combobox>
    {/if}
  </div>
{:else}
  <Select
    {disabled}
    bind:value={currentValue}
    label={sortedOptions.find(({ value }) => value === currentValue)?.label || undefined}
  >
    {#each sortedOptions as { label, value } (value)}
      <Option {label} {value} selected={value === currentValue} />
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
      padding: 4px 12px;
      border-radius: var(--control--medium--border-radius);
      background-color: var(--secondary-background-color);

      :global(.icon) {
        font-size: var(--font-size--large);
      }
    }
  }
</style>
