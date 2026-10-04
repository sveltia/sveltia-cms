<script>
  import { untrack } from 'svelte';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getMediaFieldPreview } from '$lib/services/contents/fields/file/preview';
  import { watchAsync } from '$lib/services/utils/state.svelte';

  /**
   * @import { AssetKind } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} value Field value, either a URL or a file path.
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string} [typedKeyPath] Field key path for field-level media folders.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    value,
    fieldConfig,
    typedKeyPath = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();

  const { widget: fieldType } = $derived(fieldConfig);
  const isImageField = $derived(fieldType === 'image');
  const entry = $derived(entryDraft.current?.originalEntry);
  /* v8 ignore start -- the preview is only rendered while the draft is there */
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);

  // The lookup for an earlier value can be answered after the one for a later value, which
  // `watchAsync` takes care of
  watchAsync(
    () => {
      void [value];

      return untrack(async () =>
        value
          ? getMediaFieldPreview({
              value,
              // Skip the detection if it’s an Image field because we already know it’s an image
              kind: isImageField ? 'image' : undefined,
              entry,
              collectionName,
              fileName,
              fieldConfig,
              typedKeyPath,
            })
          : { kind: undefined, src: undefined },
      );
    },
    (preview) => {
      ({ kind, src } = preview);
    },
  );
</script>

{#if kind && src}
  <p>
    <AssetPreview {kind} {src} controls={['audio', 'video'].includes(kind)} />
  </p>
{:else if value.trim() && !value.startsWith('blob:')}
  <p>{value}</p>
{/if}

<style>
  /* Remove the padding to make the image full-width on small screens */
  @media (width < 768px) {
    :global([role='document'] section) > p:has(:global(img)) {
      margin-inline: calc(var(--entry-preview-padding-inline) * -1);
    }
  }
</style>
