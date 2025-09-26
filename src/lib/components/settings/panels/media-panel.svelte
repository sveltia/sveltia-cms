<script>
  import { TextInput } from '@sveltia/ui';
  import { sanitize } from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';

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
</script>

{#each enabledStockAssetProviderEntries as [serviceId, service] (serviceId)}
  {@const { serviceLabel, developerURL, apiKeyURL } = service}
  <section>
    <h4>
      {$_('prefs.media.stock_photos.title', { values: { service: serviceLabel } })}
    </h4>
    <p>
      {@html sanitize(
        $_('prefs.media.stock_photos.description', {
          values: {
            service: serviceLabel,
            homeHref: `href="${developerURL}"`,
            apiKeyHref: `href="${apiKeyURL}"`,
          },
        }),
        { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
      )}
    </p>
    <div role="none">
      {#if $prefs.apiKeys}
        <TextInput
          bind:value={$prefs.apiKeys[serviceId]}
          flex
          monospace
          spellcheck="false"
          aria-label={$_('prefs.media.stock_photos.field_label', {
            values: { service: serviceLabel },
          })}
          onchange={() => {
            onChange?.({
              message: $_(
                $prefs.apiKeys?.[serviceId]
                  ? 'prefs.changes.api_key_saved'
                  : 'prefs.changes.api_key_removed',
              ),
            });
          }}
        />
      {/if}
    </div>
  </section>
{:else}
  {$_('prefs.media.stock_photos.providers_disabled')}
{/each}
