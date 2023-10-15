<!--
  @component
  Implement the preview for the Boolean widget.
  @see https://decapcms.org/docs/widgets/#boolean
-->
<script>
  import { _ } from 'svelte-i18n';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  /**
   * @type {BooleanField}
   */
  export let fieldConfig;
  /**
   * @type {boolean}
   */
  export let currentValue;
</script>

{#if typeof currentValue === 'boolean'}
  <p>{$_(`boolean.${currentValue}`)}</p>
{/if}
