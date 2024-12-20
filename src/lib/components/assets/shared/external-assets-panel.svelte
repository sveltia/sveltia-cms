<!--
  @component
  Implement a panel that allows searching media files from an external media library and selecting
  one for an image/file entry field.
-->
<script>
  import { Button, Option, PasswordInput, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import InfiniteScroll from '$lib/components/common/infinite-scroll.svelte';
  import { selectAssetsView } from '$lib/services/contents/draft/editor';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {AssetKind} [kind] - Asset kind.
   * @property {string} [searchTerms] - Search terms for filtering assets.
   * @property {MediaLibraryService} serviceProps - Media library service details.
   * @property {string} [gridId] - The `id` attribute of the inner listbox.
   * @property {(detail: SelectedAsset) => void} [onSelect] - Custom `select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind = 'image',
    searchTerms = '',
    serviceProps,
    gridId = undefined,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    serviceType = 'stock_photos',
    serviceId = '',
    serviceLabel = '',
    hotlinking = false,
    authType = 'api_key',
    developerURL = '',
    apiKeyURL = '',
    apiKeyPattern,
    init,
    signIn,
    search,
  } = $derived(serviceProps);

  const input = $state({ userName: '', password: '' });
  let hasConfig = $state(true);
  let hasAuthInfo = $state(false);
  let apiKey = $state('');
  let userName = $state('');
  let password = $state('');
  /** @type {'initial' | 'requested' | 'success' | 'error'} */
  let authState = $state('initial');
  /** @type {ExternalAsset[] | null} */
  let searchResults = $state(null);
  /** @type {string | undefined} */
  let error = $state();

  let debounceTimer = 0;

  /**
   * Search assets.
   * @param {string} [query] - Search query.
   */
  const searchAssets = async (query = '') => {
    searchResults = null;

    try {
      searchResults = await search(query, { kind, apiKey, userName, password });
    } catch (/** @type {any} */ ex) {
      error = 'search_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  /**
   * Download the selected asset, if needed, and notify the file and credit. If hotlinking is
   * required by the service, just notify the URL instead of downloading the file.
   * @param {ExternalAsset} asset - Selected asset.
   * @todo Support video files.
   */
  const selectAsset = async (asset) => {
    const { downloadURL, fileName, credit } = asset;

    if (hotlinking) {
      onSelect?.({ url: downloadURL, credit });

      return;
    }

    try {
      const response = await fetch(downloadURL);
      const { ok, status } = response;

      if (!ok) {
        throw new Error(`The response returned with HTTP status ${status}.`);
      }

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      onSelect?.({ file, credit });
    } catch (/** @type {any} */ ex) {
      error = 'image_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  onMount(() => {
    (async () => {
      if (typeof init === 'function') {
        hasConfig = false;
        hasConfig = await init();
      }

      if (!hasConfig) {
        return;
      }

      apiKey = $prefs.apiKeys?.[serviceId] ?? '';
      [userName, password] = ($prefs.logins?.[serviceId] ?? '').split(' ');
      hasAuthInfo = !!apiKey || !!password;
      searchResults = null;

      if (hasAuthInfo) {
        searchAssets();
      }
    })();
  });

  $effect(() => {
    void searchTerms;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (hasAuthInfo) {
        searchAssets(searchTerms);
      }
    }, 1000);
  });
</script>

{#if hasAuthInfo}
  {#if error}
    <EmptyState>
      <span role="alert">{$_(`assets_dialog.error.${error}`)}</span>
    </EmptyState>
  {:else if !searchResults}
    <EmptyState>
      <span role="alert">{$_('searching')}</span>
    </EmptyState>
  {:else if !searchResults.length}
    <EmptyState>
      <span role="alert">{$_('no_files_found')}</span>
    </EmptyState>
  {:else}
    <SimpleImageGrid
      {gridId}
      viewType={$selectAssetsView?.type}
      onChange={({ value }) => {
        const asset = searchResults?.find(({ id }) => id === value);

        if (asset) {
          selectAsset(asset);
        }
      }}
    >
      <InfiniteScroll items={searchResults} itemKey="id">
        {#snippet renderItem(/** @type {ExternalAsset} */ asset)}
          {@const { id, previewURL, description, kind: _kind } = asset}
          <Option label="" value={id}>
            <AssetPreview kind={_kind} src={previewURL} variant="tile" crossorigin="anonymous" />
            <span role="none" class="name">{description}</span>
          </Option>
        {/snippet}
      </InfiniteScroll>
    </SimpleImageGrid>
  {/if}
{:else if hasConfig}
  <EmptyState>
    <p role="alert">
      {#if serviceType === 'stock_photos'}
        {@html DOMPurify.sanitize(
          $_('prefs.media.stock_photos.description', {
            values: {
              service: serviceLabel,
              homeHref: `href="${developerURL}"`,
              apiKeyHref: `href="${apiKeyURL}"`,
            },
          }),
          { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
        )}
      {/if}
      {#if serviceType === 'cloud_storage'}
        {@html DOMPurify.sanitize(
          $_(`cloud_storage.auth.${authState}`, {
            values: {
              service: serviceLabel,
            },
          }),
          { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
        )}
      {/if}
    </p>
    {#if authType === 'api_key'}
      <div role="none" class="input-outer">
        <TextInput
          flex
          spellcheck="false"
          aria-label={$_('prefs.media.stock_photos.field_label', {
            values: { service: serviceLabel },
          })}
          oninput={(event) => {
            const _value = /** @type {HTMLInputElement} */ (event.target).value.trim();

            if (apiKeyPattern?.test(_value)) {
              apiKey = _value;
              hasAuthInfo = true;
              $prefs.apiKeys ??= {};
              $prefs.apiKeys[serviceId] = apiKey;
              searchAssets();
            }
          }}
        />
      </div>
    {/if}
    {#if authType === 'password'}
      <div role="none" class="input-outer">
        <TextInput
          flex
          spellcheck="false"
          aria-label={$_('user_name')}
          disabled={authState === 'requested'}
          bind:value={input.userName}
        />
      </div>
      <div role="none" class="input-outer">
        <PasswordInput
          aria-label={$_('password')}
          disabled={authState === 'requested'}
          bind:value={input.password}
        />
      </div>
      <div role="none" class="input-outer">
        <Button
          variant="secondary"
          label={$_('sign_in')}
          disabled={!input.userName || !input.password || authState === 'requested'}
          onclick={async () => {
            authState = 'requested';
            input.userName = input.userName.trim();
            input.password = input.password.trim();

            if (await signIn?.(input.userName, input.password)) {
              authState = 'success';
              userName = input.userName;
              password = input.password;
              hasAuthInfo = true;
              $prefs.logins ??= {};
              $prefs.logins[serviceId] = [userName, password].join(' ');
              searchAssets();
            } else {
              authState = 'error';
            }
          }}
        />
      </div>
    {/if}
  </EmptyState>
{:else}
  <EmptyState>
    <span role="alert">{$_('cloud_storage.invalid')}</span>
  </EmptyState>
{/if}

<style lang="scss">
  p {
    margin: 0 0 8px;
  }

  .input-outer {
    width: 400px;
    text-align: center;
  }
</style>
