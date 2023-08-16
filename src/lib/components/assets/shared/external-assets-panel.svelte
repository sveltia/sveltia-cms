<!--
  @component
  Implement a panel that allows searching media files from an external media library and selecting
  one for an image/file entry field.
-->
<script>
  import { Button, Option, PasswordInput, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';
  import { prefs } from '$lib/services/prefs';

  /**
   * @type {'image' | 'any'}
   */
  export let kind = 'image';

  /**
   * @type {string}
   */
  export let searchTerms = '';

  /**
   * @type {MediaLibraryService}
   */
  export let serviceProps = undefined;

  $: ({
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
  } = serviceProps);

  const dispatch = createEventDispatcher();
  const input = { userName: '', password: '' };
  let hasConfig = true;
  let hasAuthInfo = false;
  let apiKey = '';
  let userName = '';
  let password = '';
  let debounceTimer = 0;
  /**
   * @type {'initial' | 'requested' | 'success' | 'error'}
   */
  let authState = 'initial';
  /**
   * @type {?ExternalAsset[]}
   */
  let searchResults = null;
  /**
   * @type {string}
   */
  let error = undefined;

  /**
   * Search assets.
   * @param {string} [query] Search query.
   */
  const searchAssets = async (query = '') => {
    searchResults = null;

    try {
      searchResults = await search(query, { kind, apiKey, userName, password });
    } catch {
      error = 'search_fetch_failed';
    }
  };

  /**
   * Download the selected asset, if needed, and notify the file and credit. If hotlinking is
   * required by the service, just notify the URL instead of downloading the file.
   * @param {ExternalAsset} asset Selected asset.
   * @todo Support video files.
   */
  const selectAsset = async (asset) => {
    const { downloadURL, fileName, credit } = asset;

    if (hotlinking) {
      dispatch('select', { url: downloadURL, credit });

      return;
    }

    try {
      const response = await fetch(downloadURL);

      if (!response.ok) {
        throw new Error();
      }

      const file = new File([await response.blob()], fileName, { type: 'image/jpeg' });

      dispatch('select', { file, credit });
    } catch {
      error = 'image_fetch_failed';
    }
  };

  $: {
    if (searchTerms) {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        searchAssets(searchTerms);
      }, 1000);
    }
  }

  onMount(() => {
    (async () => {
      if (typeof init === 'function') {
        hasConfig = false;
        hasConfig = await init();
      }

      if (!hasConfig) {
        return;
      }

      apiKey = $prefs.apiKeys?.[serviceId] || '';
      [userName, password] = ($prefs.logins?.[serviceId] || '').split(' ');
      hasAuthInfo = !!apiKey || !!password;
      searchResults = null;

      if (hasAuthInfo) {
        searchAssets();
      }
    })();
  });
</script>

{#if hasAuthInfo}
  {#if error}
    <EmptyState>
      <span>{$_(`assets_dialog.error.${error}`)}</span>
    </EmptyState>
  {:else if !searchResults}
    <EmptyState>
      <span>{$_('searching')}</span>
    </EmptyState>
  {:else if !searchResults.length}
    <EmptyState>
      <span>{$_('no_files_found')}</span>
    </EmptyState>
  {:else}
    <SimpleImageGrid
      viewType={$selectAssetsView?.type}
      on:select={(/** @type {CustomEvent} */ event) => {
        selectAsset(searchResults.find(({ id }) => id === event.detail.value));
      }}
    >
      {#each searchResults as { id, previewURL, description, kind: _kind } (id)}
        <Option value={id}>
          {#if _kind === 'image'}
            <Image src={previewURL} crossorigin="anonymous" />
          {/if}
          {#if _kind === 'video'}
            <Video src={previewURL} crossorigin="anonymous" />
          {/if}
          <span class="name">{description}</span>
        </Option>
      {/each}
    </SimpleImageGrid>
  {/if}
{:else if hasConfig}
  <EmptyState>
    <p>
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
      <div class="input-outer">
        <TextInput
          spellcheck="false"
          aria-label={$_('prefs.media.stock_photos.field_label', {
            values: { service: serviceLabel },
          })}
          on:input={(/** @type {CustomEvent} */ event) => {
            /**
             * @type {string}
             */
            const _value = event.detail.value.trim();

            if (apiKeyPattern && _value.match(apiKeyPattern)) {
              apiKey = _value;
              $prefs.apiKeys ||= {};
              $prefs.apiKeys[serviceId] = apiKey;
              searchAssets();
            }
          }}
        />
      </div>
    {/if}
    {#if authType === 'password'}
      <div class="input-outer">
        <TextInput
          spellcheck="false"
          aria-label={$_('user_name')}
          disabled={authState === 'requested'}
          bind:value={input.userName}
        />
      </div>
      <div class="input-outer">
        <PasswordInput
          spellcheck="false"
          aria-label={$_('password')}
          disabled={authState === 'requested'}
          bind:value={input.password}
        />
      </div>
      <div class="input-outer">
        <Button
          class="secondary"
          label={$_('sign_in')}
          disabled={!input.userName || !input.password || authState === 'requested'}
          on:click={async () => {
            authState = 'requested';
            input.userName = input.userName.trim();
            input.password = input.password.trim();

            if (await signIn(input.userName, input.password)) {
              authState = 'success';
              userName = input.userName;
              password = input.password;
              hasAuthInfo = true;
              $prefs.logins ||= {};
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
    <p>
      {$_('cloud_storage.invalid')}
    </p>
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
