<!--
  @component
  Implement the preview for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getMediaFieldURL, getMediaKind } from '$lib/services/assets';
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
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {string | undefined}
   */
  export let currentValue;

  /**
   * @type {AssetKind | null | undefined}
   */
  let kind;
  /**
   * @type {string | undefined}
   */
  let src;

  /**
   * Update a couple of properties when {@link currentValue} is updated.
   */
  const updateProps = async () => {
    kind = currentValue ? await getMediaKind(currentValue) : undefined;
    src =
      currentValue && kind
        ? await getMediaFieldURL(currentValue, $entryDraft?.originalEntry)
        : undefined;
  };

  $: {
    void currentValue;
    updateProps();
  }
</script>

{#if kind && src}
  <p>
    <AssetPreview {kind} {src} controls={['audio', 'video'].includes(kind)} />
  </p>
{:else if typeof currentValue === 'string' && currentValue.trim() && !currentValue.startsWith('blob:')}
  <p>{currentValue}</p>
{/if}
