<!--
  @component
  Implement the editor for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
  @todo Replace the native `<input>` with a custom component.
  @todo Support the `enableAlpha` option.
-->
<script>
  import { Button, Icon, TextInput } from '@sveltia/ui';
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
    // enableAlpha = false,
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
    class="tertiary iconic"
    disabled={!currentValue}
    on:click={() => {
      currentValue = '';
    }}
  >
    <Icon slot="start-icon" name="delete" label={$_('clear')} />
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
</style>
