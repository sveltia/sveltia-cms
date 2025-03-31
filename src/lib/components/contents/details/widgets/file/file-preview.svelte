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
   * @import { AssetKind, WidgetPreviewProps } from '$lib/types/private';
   * @import { FileField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {FileField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();

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

  $effect(() => {
    void [currentValue];
    updateProps();
  });
</script>

{#if kind && src}
  <p>
    <AssetPreview {kind} {src} controls={['audio', 'video'].includes(kind)} />
  </p>
{:else if typeof currentValue === 'string' && currentValue.trim() && !currentValue.startsWith('blob:')}
  <p>{currentValue}</p>
{/if}
