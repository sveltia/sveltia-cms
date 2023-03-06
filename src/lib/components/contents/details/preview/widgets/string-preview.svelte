<!--
  @component
  Implement the preview for the String widget.
  @see https://www.netlifycms.org/docs/widgets/#string
-->
<script>
  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({ name: fieldName } = fieldConfig);
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  {#if fieldName === 'title'}
    <p class="title">{currentValue}</p>
  {:else}
    <p>{currentValue}</p>
  {/if}
{/if}

<style lang="scss">
  p {
    margin: 8px 0;
  }

  .title {
    font-size: 24px;
    font-weight: 600;
  }
</style>
