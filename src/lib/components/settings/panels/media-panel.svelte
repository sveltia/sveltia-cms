<script>
  import { _ } from '@sveltia/i18n';

  import ApiKeyInput from '$lib/components/settings/controls/api-key-input.svelte';
  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import {
    allStockAssetProviders,
    getStockAssetMediaLibraryOptions,
  } from '$lib/services/integrations/media-libraries/stock';
  import { makeLink } from '$lib/services/utils/string';

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

  const enabledCloudServiceEntries = $derived(
    Object.entries(allCloudStorageServices).filter(
      ([, { isEnabled, authType }]) => (isEnabled?.() ?? true) && authType !== 'widget',
    ),
  );
</script>

<section>
  <h3>{_('prefs.media.cloud_storage.api_keys.title')}</h3>
  <p>
    {@html makeLink(
      enabledCloudServiceEntries.length
        ? _('prefs.media.cloud_storage.api_keys.description')
        : _('prefs.media.cloud_storage.no_services'),
      'https://sveltiacms.app/en/docs/media',
    )}
  </p>
  {#each enabledCloudServiceEntries as [serviceId, service] (serviceId)}
    {@const label = service.serviceLabel}
    <section>
      <h4>{label}</h4>
      <div role="none">
        <ApiKeyInput
          {serviceId}
          {service}
          ariaLabel={_('prefs.media.cloud_storage.field_label', { values: { service: label } })}
          {onChange}
        />
      </div>
    </section>
  {/each}
</section>
<section>
  <h3>{_('prefs.media.stock_photos.api_keys.title')}</h3>
  <p>
    {@html makeLink(
      enabledStockAssetProviderEntries.length
        ? _('prefs.media.stock_photos.api_keys.description')
        : _('prefs.media.stock_photos.no_services'),
      'https://sveltiacms.app/en/docs/integrations/stock-photos',
    )}
  </p>
  {#each enabledStockAssetProviderEntries as [serviceId, service] (serviceId)}
    {@const label = service.serviceLabel}
    <section>
      <h4>{label}</h4>
      <div role="none">
        <ApiKeyInput
          {serviceId}
          {service}
          ariaLabel={_('prefs.media.stock_photos.field_label', { values: { service: label } })}
          {onChange}
        />
      </div>
    </section>
  {/each}
</section>
