<!--
  @component
  Implement the preview for the Number widget.
  @see https://www.netlifycms.org/docs/widgets/#number
-->
<script>
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;
</script>

{#if typeof currentValue === 'number'}
  <p>{Intl.NumberFormat(locale).format(currentValue)}</p>
{/if}
