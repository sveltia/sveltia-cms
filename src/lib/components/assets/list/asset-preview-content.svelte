<!--
  @component
  Preview of an asset in the details overlay, shared by repository folders and external locations:
  a media player or image for a media file, a sandboxed frame for a PDF, the content of a text file,
  or a notice that the file can’t be previewed.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';

  import TextPreview from '$lib/components/assets/list/text-preview.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { isMediaKind } from '$lib/services/assets/kinds';

  /**
   * @import { Asset, AssetKind } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetKind | undefined} kind Asset kind.
   * @property {string} name File name.
   * @property {string | null | undefined} type MIME type of the file, if known.
   * @property {Asset} [asset] Repository asset to preview. If given, a media file is previewed from
   * it rather than from `src`.
   * @property {string | undefined} src URL of the file.
   * @property {boolean} [pending] Whether the file’s type is still being looked up, in which case
   * a file other than a media file is shown as loading rather than unavailable.
   * @property {() => Promise<string> | string} getText Function to get the content of a text file.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind,
    name,
    type,
    asset = undefined,
    src,
    pending = false,
    getText,
    /* eslint-enable prefer-const */
  } = $props();

  /** A media file is previewed from the asset if there is one, as the URL may not be ready yet. */
  const mediaSrc = $derived(asset ? undefined : src);
</script>

{#if kind && isMediaKind(kind)}
  <AssetPreview
    {kind}
    {asset}
    src={mediaSrc}
    blurBackground={['image', 'video'].includes(kind)}
    checkerboard={kind === 'image'}
    alt={kind === 'image' ? name : undefined}
    controls={['audio', 'video'].includes(kind)}
    loading="eager"
    dissolve={false}
    holdTransition={true}
  />
{:else if pending}
  <EmptyState>
    <span role="alert">{_('loading')}</span>
  </EmptyState>
{:else if type === 'application/pdf'}
  <iframe {src} title={name} sandbox="allow-scripts"></iframe>
{:else if type && isTextFileType(type)}
  {#await getText()}
    <EmptyState>
      <span role="alert">{_('loading')}</span>
    </EmptyState>
  {:then text}
    <TextPreview {text} {name} />
  {:catch}
    <EmptyState>
      <span role="alert">{_('preview_unavailable')}</span>
    </EmptyState>
  {/await}
{:else}
  <EmptyState>
    <span role="alert">{_('preview_unavailable')}</span>
  </EmptyState>
{/if}
