<!--
  @component
  Implement the preview for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import Image from '$lib/components/common/image.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { entryDraft } from '$lib/services/contents/editor';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {FileField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string}
   */
  export let currentValue = undefined;

  $: ({ widget } = fieldConfig);
</script>

{#if widget === 'image' && currentValue}
  {@const src = getMediaFieldURL(currentValue, $entryDraft.originalEntry)}
  {#if src}
    <p>
      <Image {src} />
    </p>
  {/if}
{:else if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}
