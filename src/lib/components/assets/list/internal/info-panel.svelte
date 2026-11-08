<script>
  import { _, locale as appLocale } from '@sveltia/i18n';

  import FileInfoSections from '$lib/components/assets/list/file-info-sections.svelte';
  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';
  import UsedEntries from '$lib/components/assets/list/used-entries.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import LeafletMap from '$lib/components/common/leaflet-map.svelte';
  import {
    defaultAssetDetails,
    getAssetDetails,
    getAssetUsedEntries,
  } from '$lib/services/assets/details';
  import { isMediaKind, isPDF } from '$lib/services/assets/kinds';
  import { getCommitAuthorName } from '$lib/services/utils/commit-author';
  import { formatDate } from '$lib/services/utils/date';
  import { createLatestGuard } from '$lib/services/utils/scheduling';

  /**
   * @import { Asset, AssetDetails, Entry } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} asset Asset.
   * @property {boolean} [showPreview] Whether to show the media preview.
   */

  /** @type {Props} */
  let { asset, showPreview = false } = $props();

  /** @type {AssetDetails} */
  let details = $state({ ...defaultAssetDetails });

  // @todo Fetch file size and commit info on demand for GitLab
  const { path, size, kind, commitAuthor, commitDate } = $derived(asset);
  const { publicURL, repoBlobURL, dimensions, duration, createdDate, coordinates, usedEntries } =
    $derived(details);
  const canPreview = $derived(isMediaKind(kind) || isPDF(path));

  /**
   * Guard for {@link updateProps}. The panel stays mounted while the focus moves from one asset
   * to another, so a slow lookup for an asset focused earlier must not overwrite the details of the
   * one focused now.
   */
  const requestGuard = createLatestGuard();

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    const _asset = asset;
    const isLatest = requestGuard.next();

    // Don’t leave the previous asset’s details on show while this one’s are being retrieved. The
    // used entries are being looked up as well
    details = { ...defaultAssetDetails, usedEntries: undefined };

    try {
      const _details = await getAssetDetails(_asset);

      if (!isLatest()) {
        return;
      }

      details = _details;
    } catch (/** @type {any} */ ex) {
      // Only the basic info is shown, but the used entries don’t depend on the details
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    /** @type {Entry[]} */
    let _usedEntries = [];

    try {
      _usedEntries = await getAssetUsedEntries(_asset);
    } catch (/** @type {any} */ ex) {
      // Stop showing the used entries as being loaded
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    if (isLatest()) {
      details.usedEntries = _usedEntries;
    }
  };

  $effect(() => {
    void [asset];
    updateProps();
  });
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
