<script>
  import { EmptyState, PasswordInput } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';

  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import {
    allStockAssetProviders,
    getStockAssetMediaLibraryOptions,
  } from '$lib/services/integrations/media-libraries/stock';
  import { prefs } from '$lib/services/user/prefs';

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
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
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
   * Sanitize the given string to allow only safe HTML tags and attributes.
   * @param {string} str The string to sanitize.
   * @returns {string} The sanitized string.
   */
  const _sanitize = (str) =>
    sanitize(str, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] });

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
    {#each enabledCloudServiceEntries as [serviceId, service] (serviceId)}
      {@const { serviceLabel } = service}
      <section>
        <h4>{serviceLabel}</h4>
        <p>
          {@html _sanitize(
            $_('prefs.media.cloud_storage.description', {
              values: { service: serviceLabel },
            }),
          )}
        </p>
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
    {#each enabledStockAssetProviderEntries as [serviceId, service] (serviceId)}
      {@const { serviceLabel, developerURL, apiKeyURL } = service}
      <section>
        <h4>{$_('prefs.media.stock_photos.title', { values: { service: serviceLabel } })}</h4>
        <p>
          {@html _sanitize(
            $_('prefs.media.stock_photos.description', {
              values: {
                service: serviceLabel,
                homeHref: `href="${developerURL}"`,
                apiKeyHref: `href="${apiKeyURL}"`,
              },
            }),
          )}
        </p>
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
  {/if}
{:else}
  <EmptyState>
    <div role="none">
      {$_('prefs.media.libraries_disabled')}
    </div>
  </EmptyState>
{/if}
