<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeySection from '$lib/components/settings/controls/api-key-section.svelte';
  import { DOCS_BASE_URL } from '$lib/services/app';
  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import {
    allStockAssetProviders,
    getStockAssetMediaLibraryOptions,
  } from '$lib/services/integrations/media-libraries/stock';

  /**
   * @import { MediaLibraryService, SettingsPanelOnChangeArgs } from '$lib/types/private';
   * @import { StockAssetProviderName } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const enabledStockAssetProviderEntries = $derived.by(() => {
    const { providers = [] } = getStockAssetMediaLibraryOptions();

    return /** @type {[StockAssetProviderName, MediaLibraryService][]} */ (
      Object.entries(allStockAssetProviders)
    ).filter(([serviceId, { authType }]) => providers.includes(serviceId) && authType !== 'none');
  });

  /* v8 ignore start -- every built-in service says whether it’s enabled */
  const enabledCloudServiceEntries = $derived(
    Object.entries(allCloudStorageServices).filter(
      ([, { isEnabled, authType }]) => (isEnabled?.() ?? true) && authType !== 'widget',
    ),
  );
  /* v8 ignore stop */
</script>

<ApiKeySection
  title={_('prefs.media.cloud_storage.api_keys.title')}
  description={enabledCloudServiceEntries.length
    ? _('prefs.media.cloud_storage.api_keys.description')
    : _('prefs.media.cloud_storage.no_services')}
  docsURL="{DOCS_BASE_URL}/media"
  entries={enabledCloudServiceEntries}
  getFieldLabel={(service) => _('prefs.media.cloud_storage.field_label', { values: { service } })}
  {onChange}
/>
<ApiKeySection
  title={_('prefs.media.stock_photos.api_keys.title')}
  description={enabledStockAssetProviderEntries.length
    ? _('prefs.media.stock_photos.api_keys.description')
    : _('prefs.media.stock_photos.no_services')}
  docsURL="{DOCS_BASE_URL}/integrations/stock-photos"
  entries={enabledStockAssetProviderEntries}
  getFieldLabel={(service) => _('prefs.media.stock_photos.field_label', { values: { service } })}
  {onChange}
/>
