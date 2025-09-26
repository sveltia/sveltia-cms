<!--
  @component
  Implement a panel that allows searching media files from an external media library and selecting
  one for an image/file entry field.
-->
<script>
  import { Button, EmptyState, InfiniteScroll, PasswordInput, TextInput } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { sanitize } from 'isomorphic-dompurify';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';
  import { isSmallScreen } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @import {
   * AssetKind,
   * ExternalAsset,
   * MediaLibraryFetchOptions,
   * MediaLibraryService,
   * SelectedResource,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetKind} [kind] Asset kind.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {MediaLibraryService} serviceProps Media library service details.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {SelectedResource[]} selectedResources Selected resources.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind = 'image',
    multiple = false,
    searchTerms = '',
    serviceProps,
    gridId = undefined,
    selectedResources = $bindable([]),
    /* eslint-enable prefer-const */
  } = $props();

  const {
    serviceType = 'stock_assets',
    serviceId = '',
    serviceLabel = '',
    hotlinking = false,
    authType = 'api_key',
    developerURL = '',
    apiKeyURL = '',
    apiKeyPattern,
    init,
    signIn,
    list,
    search,
  } = $derived(serviceProps);

  const viewType = $derived($selectAssetsView?.type);

  const input = $state({ userName: '', password: '' });
  let hasConfig = $state(true);
  let hasAuthInfo = $state(false);
  let apiKey = $state('');
  let userName = $state('');
  let password = $state('');
  /** @type {'initial' | 'requested' | 'success' | 'error'} */
  let authState = $state('initial');
  /** @type {ExternalAsset[] | null} */
  let listedAssets = $state(null);
  /** @type {string | undefined} */
  let error = $state();

  let debounceTimer = 0;

  /**
   * Search or list assets from the external media library.
   * @param {string} [query] Search query.
   */
  const getAssets = async (query = '') => {
    listedAssets = null;
    query = query.trim();

    /** @type {MediaLibraryFetchOptions} */
    const options = { kind, apiKey, userName, password };

    try {
      listedAssets = await (query ? search(query, options) : list(options));
    } catch (ex) {
      error = 'search_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  /**
   * Download the selected asset, if needed, and return the file and credit. If hotlinking is
   * required by the service, just return the URL instead of downloading the file.
   * @param {ExternalAsset} asset Selected asset.
   * @returns {Promise<SelectedResource | undefined>} The selected resource with the file or URL.
   * @todo Support video files.
   */
  const getResource = async (asset) => {
    const { downloadURL: url, fileName, credit } = asset;

    if (hotlinking) {
      return { url, credit };
    }

    try {
      const response = await fetch(url);
      const { ok, status } = response;

      if (!ok) {
        throw new Error(`The response returned with HTTP status ${status}.`);
      }

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      return { url, credit, file };
    } catch (ex) {
      error = 'image_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    return undefined;
  };

  /**
   * Check if the given asset is already selected.
   * @param {ExternalAsset} asset The asset to check.
   * @returns {boolean} `true` if the asset is selected, `false` otherwise.
   */
  const isSelected = (asset) => selectedResources.some((r) => r.url === asset.downloadURL);

  /**
   * Handle selection change of an asset.
   * @param {ExternalAsset} asset The asset whose selection changed.
   * @param {boolean} selected `true` if the asset is now selected, `false` otherwise.
   */
  const onSelectionChange = async (asset, selected) => {
    const otherResources = selectedResources.filter((r) => r.url !== asset.downloadURL);

    if (selected) {
      const resource = await getResource(asset);

      if (resource) {
        selectedResources = [...otherResources, resource];
      }
    } else {
      selectedResources = otherResources;
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
      listedAssets = null;

      if (hasAuthInfo) {
        getAssets();
      }
    })();
  });

  $effect(() => {
    void [searchTerms];
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (hasAuthInfo) {
        getAssets(searchTerms);
      }
    }, 1000);
  });
</script>

{#if hasAuthInfo}
  {#if error}
    <EmptyState>
      <span role="alert">{$_(`assets_dialog.error.${error}`)}</span>
    </EmptyState>
  {:else if !listedAssets}
    <EmptyState>
      <span role="alert">{$_('searching')}</span>
    </EmptyState>
  {:else if !listedAssets.length}
    <EmptyState>
      <span role="alert">{$_('no_files_found')}</span>
    </EmptyState>
  {:else}
    <SimpleImageGrid {viewType} {gridId} {multiple}>
      <InfiniteScroll items={listedAssets} itemKey="id">
        {#snippet renderItem(/** @type {ExternalAsset} */ asset)}
          {#await sleep() then}
            {@const { id, previewURL, description, kind: _kind } = asset}
            <SimpleImageGridItem
              value={id}
              {viewType}
              {multiple}
              selected={isSelected(asset)}
              onChange={({ detail: { selected } }) => {
                onSelectionChange(asset, selected);
              }}
            >
              <AssetPreview kind={_kind} src={previewURL} variant="tile" crossorigin="anonymous" />
              {#if !$isSmallScreen || viewType === 'list'}
                <span role="none" class="name">{description}</span>
              {/if}
            </SimpleImageGridItem>
          {/await}
        {/snippet}
      </InfiniteScroll>
    </SimpleImageGrid>
  {/if}
{:else if hasConfig}
  <EmptyState>
    <p role="alert">
      {#if serviceType === 'stock_assets'}
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
      {/if}
      {#if serviceType === 'cloud_storage'}
        {@html sanitize(
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
          monospace
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
              getAssets();
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
              getAssets();
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
    max-width: 100%;
    text-align: center;
  }
</style>
