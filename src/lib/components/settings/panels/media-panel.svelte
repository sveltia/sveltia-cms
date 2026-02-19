<script>
  import { EmptyState, PasswordInput } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import {
    allStockAssetProviders,
    getStockAssetMediaLibraryOptions,
  } from '$lib/services/integrations/media-libraries/stock';
  import { prefs } from '$lib/services/user/prefs';
  import { makeLink } from '$lib/services/utils/string';

  /**
   * @import { MediaLibraryService } from '$lib/types/private';
   * @import { StockAssetProviderName } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
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
    ).filter(([serviceId]) => providers.includes(serviceId));
  });

  const enabledCloudServiceEntries = $derived(
    Object.entries(allCloudStorageServices).filter(
      ([, { isEnabled, authType }]) => (isEnabled?.() ?? true) && authType !== 'widget',
    ),
  );

  /**
   * Handler for `change` event of the text input.
   * @param {string} serviceId The service ID whose API key has changed.
   */
  const onchange = (serviceId) => {
    onChange?.({
      message: $_(
        $prefs.apiKeys?.[serviceId]
          ? 'prefs.changes.api_key_saved'
          : 'prefs.changes.api_key_removed',
      ),
    });
  };
</script>

{#if enabledStockAssetProviderEntries.length || enabledCloudServiceEntries.length}
  {#if $prefs.apiKeys}
    {#if enabledCloudServiceEntries.length}
      <section>
        <h3>{$_('prefs.media.cloud_storage.api_keys.title')}</h3>
        <p>
          {@html makeLink(
            $_('prefs.media.cloud_storage.api_keys.description'),
            'https://sveltiacms.app/en/docs/media',
          )}
        </p>
        {#each enabledCloudServiceEntries as [serviceId, { serviceLabel }] (serviceId)}
          <section>
            <h4>{serviceLabel}</h4>
            <div role="none">
              <PasswordInput
                bind:value={$prefs.apiKeys[serviceId]}
                flex
                autocomplete="off"
                spellcheck="false"
                aria-label={$_('prefs.media.cloud_storage.field_label', {
                  values: { service: serviceLabel },
                })}
                onchange={() => onchange(serviceId)}
              />
            </div>
          </section>
        {/each}
      </section>
    {/if}
    {#if enabledStockAssetProviderEntries.length}
      <section>
        <h3>{$_('prefs.media.stock_photos.api_keys.title')}</h3>
        <p>
          {@html makeLink(
            $_('prefs.media.stock_photos.api_keys.description'),
            'https://sveltiacms.app/en/docs/integrations/stock-photos',
          )}
        </p>
        {#each enabledStockAssetProviderEntries as [serviceId, { serviceLabel }] (serviceId)}
          <section>
            <h4>{serviceLabel}</h4>
            <div role="none">
              <PasswordInput
                bind:value={$prefs.apiKeys[serviceId]}
                flex
                autocomplete="off"
                spellcheck="false"
                aria-label={$_('prefs.media.stock_photos.field_label', {
                  values: { service: serviceLabel },
                })}
                onchange={() => onchange(serviceId)}
              />
            </div>
          </section>
        {/each}
      </section>
    {/if}
  {/if}
{:else}
  <EmptyState>
    <div role="none">
      {$_('prefs.media.libraries_disabled')}
    </div>
  </EmptyState>
{/if}
