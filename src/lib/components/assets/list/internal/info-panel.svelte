<script>
  import { _, locale as appLocale } from '@sveltia/i18n';

  import FileInfoSections from '$lib/components/assets/list/file-info-sections.svelte';
  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';
  import UsedEntries from '$lib/components/assets/list/used-entries.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import LeafletMap from '$lib/components/common/leaflet-map.svelte';
  import { createAssetDetailsState } from '$lib/services/assets/details-state.svelte';
  import { isMediaKind, isPDF } from '$lib/services/assets/kinds';
  import { getCommitAuthorName } from '$lib/services/utils/commit-author';
  import { formatDate } from '$lib/services/utils/date';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} asset Asset.
   * @property {boolean} [showPreview] Whether to show the media preview.
   */

  /** @type {Props} */
  let { asset, showPreview = false } = $props();

  // The panel stays mounted while the focus moves from one asset to another
  const details = createAssetDetailsState(() => asset, { withUsedEntries: true });

  // @todo Fetch file size and commit info on demand for GitLab
  const { path, size, kind, commitAuthor, commitDate } = $derived(asset);
  const { publicURL, repoBlobURL, dimensions, duration, createdDate, coordinates, usedEntries } =
    $derived(details.current);
  const canPreview = $derived(isMediaKind(kind) || isPDF(path));
</script>

{#snippet preview()}
  <AssetPreview
    {kind}
    {asset}
    variant="tile"
    checkerboard={kind === 'image'}
    controls={['audio', 'video'].includes(kind)}
  />
{/snippet}

<InfoPanelLayout preview={showPreview && canPreview ? preview : undefined}>
  <FileInfoSections
    fileName={path}
    {kind}
    {size}
    hasDimensions={canPreview}
    {dimensions}
    {duration}
  />
  <section>
    <h4>{_('public_urls', { values: { count: 1 } })}</h4>
    <p>
      {#if publicURL}
        <a href={publicURL} dir="ltr" target="_blank" rel="noopener noreferrer">{publicURL}</a>
      {:else}
        –
      {/if}
    </p>
  </section>
  <section>
    <h4>{_('file_paths', { values: { count: 1 } })}</h4>
    <p>
      {#if repoBlobURL}
        <a href={repoBlobURL} dir="ltr">/{path}</a>
      {:else}
        <bdi dir="ltr">/{path}</bdi>
      {/if}
    </p>
  </section>
  <UsedEntries entries={usedEntries} />
  {#if commitAuthor}
    <section>
      <h4>{_('sort_keys.commit_author')}</h4>
      <p>{getCommitAuthorName(commitAuthor)}</p>
    </section>
  {/if}
  {#if commitDate}
    <section>
      <h4>{_('sort_keys.commit_date')}</h4>
      <p>{formatDate(commitDate, appLocale.current)}</p>
    </section>
  {/if}
  {#if createdDate}
    <section>
      <h4>{_('created_date')}</h4>
      <p>{formatDate(createdDate, appLocale.current)}</p>
    </section>
  {/if}
  {#if coordinates}
    <section>
      <h4>{_('location')}</h4>
      <LeafletMap {coordinates} />
    </section>
  {/if}
</InfoPanelLayout>
