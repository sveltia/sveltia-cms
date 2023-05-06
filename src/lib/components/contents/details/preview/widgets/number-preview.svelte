<!--
  @component
  Implement the preview for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;
</script>

{#if currentValue !== undefined}
  <p>{Intl.NumberFormat(locale).format(currentValue)}</p>
{/if}
