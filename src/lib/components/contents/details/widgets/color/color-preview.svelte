<!--
  @component
  Implement the preview for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
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
  <p>
    <span class="preview">
      <span class="color" style:background-color={currentValue} />
      <span class="value">{currentValue}</span>
    </span>
  </p>
{/if}

<style lang="scss">
  .preview {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .color {
      display: block;
      width: 24px;
      height: 24px;
      border-radius: 24px;
    }
  }
</style>
