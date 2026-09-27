<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert } from '@sveltia/ui';

  import FileInfoSections from '$lib/components/assets/list/file-info-sections.svelte';
  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';
  import UsedEntries from '$lib/components/assets/list/used-entries.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { externalAssetAvailability } from '$lib/services/assets/external/availability';
  import {
    getExternalAssetDetails,
    getExternalAssetUsedEntries,
  } from '$lib/services/assets/external/details';
  import { isMediaKind } from '$lib/services/assets/kinds';
  import { formatDate } from '$lib/services/utils/date';

  /**
   * @import { ExternalAssetDetails } from '$lib/services/assets/external/details';
   * @import { Entry, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ExternalAsset} asset Asset.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {ExternalAssetDetails} */
  let details = $state({});
  /** @type {Entry[] | undefined} */
  let usedEntries = $state();

  const { fileName, description, previewURL, downloadURL, kind, size, lastModified } =
    $derived(asset);
  const { dimensions, duration } = $derived(details);
  const canPreview = $derived(isMediaKind(kind));
  /** Only a file linked from an entry is checked, so this is never `true` on a cloud service. */
  const unavailable = $derived(externalAssetAvailability.current[asset.id] === false);

  /**
   * Asset the details were last requested for. The panel stays mounted while the focus moves from
   * one asset to another, so a slow lookup for an asset focused earlier must not overwrite the
   * details of the one focused now.
   * @type {ExternalAsset | undefined}
   */
  let requestedAsset;

  /**
   * Update the properties above.
   * @param {ExternalAsset} _asset Asset to look up. Passed rather than read from the prop, because
   * the prop is gone once the panel is destroyed, e.g. when the Info pane is hidden by a window
   * resize, while this is still awaiting the service.
   */
  const updateProps = async (_asset) => {
    requestedAsset = _asset;
    details = {};
    usedEntries = undefined;

    try {
      const _details = await getExternalAssetDetails(_asset);

      if (requestedAsset !== _asset) {
        return;
      }

      details = _details;
    } catch {
      // The file could not be loaded; leave the media info out
    }

    const _usedEntries = await getExternalAssetUsedEntries(_asset);

    if (requestedAsset === _asset) {
      usedEntries = _usedEntries;
    }
  };

  $effect(() => {
    updateProps(asset);
  });
</script>

{#snippet preview()}
  <AssetPreview
    {kind}
    src={kind === 'image' ? previewURL : downloadURL}
    alt={fileName}
    variant="tile"
    checkerboard={kind === 'image'}
    controls={['audio', 'video'].includes(kind)}
  />
{/snippet}

<InfoPanelLayout preview={canPreview ? preview : undefined}>
  {#if unavailable}
    <div role="none" class="unavailable">
      <!-- Not announced on focus: the badge in the list has already told the user -->
      <Alert status="error" ariaLive="off">{_('file_unavailable_description')}</Alert>
    </div>
  {/if}
  <FileInfoSections {fileName} {kind} {size} hasDimensions={canPreview} {dimensions} {duration} />
  <section>
    <h4>{_('public_urls', { values: { count: 1 } })}</h4>
    <p>
      <a href={downloadURL} dir="ltr" target="_blank" rel="noopener noreferrer">{downloadURL}</a>
    </p>
  </section>
  <!-- A file linked from an entry has nothing but its URL, so the path is left out -->
  {#if description && description !== fileName && description !== downloadURL}
    <section>
      <h4>{_('file_paths', { values: { count: 1 } })}</h4>
      <p><bdi dir="ltr">{description}</bdi></p>
    </section>
  {/if}
  <UsedEntries entries={usedEntries} />
  {#if lastModified}
    <section>
      <h4>{_('sort_keys.last_modified')}</h4>
      <p>{formatDate(lastModified, appLocale.current)}</p>
    </section>
  {/if}
</InfoPanelLayout>

<style>
  .unavailable {
    margin: 0 0 16px;
  }
</style>
