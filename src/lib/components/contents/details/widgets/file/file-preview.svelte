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

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {FileField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({ widget } = fieldConfig);
</script>

{#if widget === 'image' && currentValue}
  {#await getMediaFieldURL(currentValue, $entryDraft.originalEntry) then src}
    <p>
      <Image {src} />
    </p>
  {/await}
{:else if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}
