<script>
  import { untrack } from 'svelte';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { getMediaKind } from '$lib/services/assets/kinds';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { AssetKind } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} value Field value, either a URL or a file path.
   * @property {boolean} [isImageField] Whether the field is an image field.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    value,
    isImageField = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();

  const entry = $derived($entryDraft?.originalEntry);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);

  $effect(() => {
    void [value];

    untrack(async () => {
      // Determine the kind and source URL of the media. Skip if it’s an image field because we
      // already know it’s an image. It’s rather problematic if the path doesn’t have an extension.
      kind = value ? (isImageField ? 'image' : await getMediaKind(value)) : undefined;
      src = kind ? await getMediaFieldURL({ value, entry, collectionName, fileName }) : undefined;
    });
  });
</script>

{#if kind && src}
  <p>
    <AssetPreview {kind} {src} controls={['audio', 'video'].includes(kind)} />
  </p>
{:else if value.trim() && !value.startsWith('blob:')}
  <p>{value}</p>
{/if}

<style lang="scss">
  // Remove the padding to make the image full-width on small screens
  @media (width < 768px) {
    p:has(:global(img)) {
      :global([role='document'] section) > & {
        margin-inline: calc(var(--entry-preview-padding-inline) * -1);
      }
    }
  }
</style>
