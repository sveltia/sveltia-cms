<!--
  @component
  Implement the preview for the Boolean widget.
  @see https://www.netlifycms.org/docs/widgets/#boolean
-->
<script>
  import { _ } from 'svelte-i18n';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;
</script>

{#if typeof currentValue === 'boolean'}
  <p>{$_(`boolean.${currentValue}`)}</p>
{/if}
