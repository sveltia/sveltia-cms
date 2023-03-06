<!--
  @component
  Implement the preview for the File and Image widgets.
  @see https://www.netlifycms.org/docs/widgets/#file
  @see https://www.netlifycms.org/docs/widgets/#image
-->
<script>
  import { getAssetByPublicPath } from '$lib/services/assets';
  import { getAssetURL } from '$lib/services/assets/view';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({ widget } = fieldConfig);
</script>

{#if widget === 'image' && currentValue}
  {@const asset = currentValue.startsWith('/') ? getAssetByPublicPath(currentValue) : undefined}
  <p>
    <img loading="lazy" src={asset ? getAssetURL(asset) : currentValue} alt="" />
  </p>
{:else if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}
