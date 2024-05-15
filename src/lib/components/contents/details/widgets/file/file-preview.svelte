<!--
  @component
  Implement the preview for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import Image from '$lib/components/common/image.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {FieldKeyPath}
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

  /**
   * @type {string | undefined}
   */
  let src;

  $: ({ widget: widgetName } = fieldConfig);
  $: isImageWidget = widgetName === 'image';

  $: (async () => {
    src =
      isImageWidget && currentValue
        ? await getMediaFieldURL(currentValue, $entryDraft?.originalEntry)
        : undefined;
  })();
</script>

{#if src}
  <p>
    <Image {src} />
  </p>
{:else if typeof currentValue === 'string' && currentValue.trim() && !currentValue.startsWith('data:')}
  <p>{currentValue}</p>
{/if}
