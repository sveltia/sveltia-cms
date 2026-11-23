<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeySection from '$lib/components/settings/controls/api-key-section.svelte';
  import { DOCS_BASE_URL } from '$lib/services/app';
  import {
    getCloudStorageServiceEntries,
    getStockPhotoServiceEntries,
  } from '$lib/services/integrations/api-key-services';

  /**
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let { onChange = undefined } = $props();

  const enabledStockAssetProviderEntries = $derived(getStockPhotoServiceEntries());
  const enabledCloudServiceEntries = $derived(getCloudStorageServiceEntries());
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
