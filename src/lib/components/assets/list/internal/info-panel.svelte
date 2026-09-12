<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { getPathInfo } from '@sveltia/utils/file';
  import mime from 'mime';

  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';
  import UsedEntries from '$lib/components/assets/list/used-entries.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import LeafletMap from '$lib/components/common/leaflet-map.svelte';
  import {
    defaultAssetDetails,
    getAssetDetails,
    getAssetUsedEntries,
  } from '$lib/services/assets/details';
  import { isMediaKind } from '$lib/services/assets/kinds';
  import { formatDate } from '$lib/services/utils/date';
  import { formatSize } from '$lib/services/utils/file';
  import { formatDuration } from '$lib/services/utils/media/video';

  /**
   * @import { Asset, AssetDetails } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} asset Asset.
   * @property {boolean} [showPreview] Whether to show the media preview.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    showPreview = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetDetails} */
  let details = $state({ ...defaultAssetDetails });

  // @todo Fetch file size and commit info on demand for GitLab
  const { path, size, kind, commitAuthor, commitDate } = $derived(asset);
  const { publicURL, repoBlobURL, dimensions, duration, createdDate, coordinates, usedEntries } =
    $derived(details);
  const { extension = '' } = $derived(getPathInfo(path));
  const canPreview = $derived(isMediaKind(kind) || path.endsWith('.pdf'));

  /**
   * Update the properties above.
   */
  const updateProps = async () => {
    details = asset ? await getAssetDetails(asset) : { ...defaultAssetDetails };
    details.usedEntries = asset ? await getAssetUsedEntries(asset) : [];
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
  <section>
    <h4>{_('kind')}</h4>
    <p>
      {_(`file_type_labels.${extension}`, {
        default: mime.getType(path) ?? extension.toUpperCase(),
      })}
    </p>
  </section>
  {#if !!size}
    <section>
      <h4>{_('size')}</h4>
      <p>
        {#key appLocale.current}
          {formatSize(size)}
        {/key}
      </p>
    </section>
  {/if}
  {#if canPreview}
    <section>
      <h4>{_('dimensions')}</h4>
      <p>{dimensions ? `${dimensions.width}×${dimensions.height}` : '–'}</p>
    </section>
  {/if}
  {#if ['audio', 'video'].includes(kind)}
    <section>
      <h4>{_('duration')}</h4>
      <p>{duration ? formatDuration(duration) : '–'}</p>
    </section>
  {/if}
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
      <p>{commitAuthor.name || commitAuthor.login || commitAuthor.email}</p>
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
