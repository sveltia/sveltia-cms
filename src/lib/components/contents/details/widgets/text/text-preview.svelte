<!--
  @component
  Implement the preview for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}
