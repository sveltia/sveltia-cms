<!--
  @component
  Implement the editor for the Color widget.
  @see https://www.netlifycms.org/docs/widgets/#color
  @todo Replace the native `<input>` with a custom component.
  @todo Support the `enableAlpha` option.
-->
<script>
  import { Button, TextInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    allowInput = false,
    enableAlpha = false,
  } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
</script>

<div>
  <input type="color" {disabled} bind:value={currentValue} />
  <span class="value">
    {#if allowInput}
      <TextInput bind:value={currentValue} />
    {:else}
      {currentValue || ''}
    {/if}
  </span>
  <Button
    class="ternary iconic"
    disabled={!currentValue}
    iconName="delete"
    iconLabel={$_('clear')}
    on:click={() => {
      currentValue = '';
    }}
  />
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
</style>
