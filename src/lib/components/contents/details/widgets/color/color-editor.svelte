<!--
  @component
  Implement the editor for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
  @todo Replace the native `<input>` with a custom component and support the `enableAlpha` option.
-->
<script>
  import { Button, Icon, TextInput, getRandomId } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
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
   * @type {ColorField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
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

  $: ({
    // Widget-specific options
    allowInput = false,
    // enableAlpha = false,
  } = fieldConfig);

  const id = getRandomId('color');
</script>

<div role="none">
  <input
    id="{id}-picker"
    type="color"
    bind:value={currentValue}
    {readonly}
    aria-invalid={invalid}
    aria-readonly={readonly}
    aria-required={required}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
  <span role="none" class="value">
    {#if allowInput}
      <TextInput
        id="{id}-input"
        bind:value={currentValue}
        {invalid}
        {readonly}
        {required}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
      />
    {:else}
      {currentValue ?? ''}
    {/if}
  </span>
  <Button
    variant="tertiary"
    iconic
    disabled={!currentValue}
    aria-label={$_('clear')}
    aria-controls={`${id}-picker ${allowInput ? `${id}-input` : ''}`}
    on:click={() => {
      currentValue = '';
    }}
  >
    <Icon slot="start-icon" name="delete" />
  </Button>
</div>

<style lang="scss">
  div {
    display: flex;
    align-items: center;
    gap: 8px;

    .value {
      flex: auto;
    }
  }

  input {
    font-family: var(--sui-textbox-font-family);
  }
</style>
