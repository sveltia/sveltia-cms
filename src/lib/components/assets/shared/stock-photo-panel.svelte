<!--
  @component
  Implement a panel that allows searching free stock photos from an API and selecting one for an
  image entry field.
-->
<script>
  import { Option, TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import SimpleImageGrid from '$lib/components/assets/shared/simple-image-grid.svelte';

  export let searchTerms = '';

  export let serviceId = '';
  export let serviceLabel = '';
  export let hotlinking = false;
  export let landingURL = '';
  export let apiKeyURL = '';
  export let apiKeyPattern = undefined;

  /**
   * Function to search images for the service.
   *
   * @returns {Promise<StockPhoto[]>} Photos.
   */
  export let searchImages = async () => [];

  const dispatch = createEventDispatcher();
  let apiKey = '';
  let debounceTimer = 0;
  /** @type {?StockPhoto[]} */
  let searchResults = null;
  let error = undefined;

  /**
   * Search images.
   *
   * @param {string} [query] Search query.
   */
  const _searchImages = async (query = '') => {
    searchResults = null;

    try {
      searchResults = await searchImages(query, apiKey);
    } catch {
      error = 'search_fetch_failed';
    }
  };

  /**
   * Download the selected image and notify the file and credit. If hotlinking is allowed/required
   * by the provider, notify the URL instead of downloading the file.
   *
   * @param {StockPhoto} photo Selected photo.
   */
  const selectImage = async (photo) => {
    const { downloadURL, fileName, credit } = photo;

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
        _searchImages(searchTerms);
      }, 1000);
    }
  }

  onMount(() => {
    apiKey = $prefs.apiKeys[serviceId] || '';
    searchResults = null;

    if (apiKey) {
      _searchImages();
    }
  });
</script>

{#if apiKey}
  {#if error}
    <EmptyState>
      <span>{$_(`stock_photos.error.${error}`)}</span>
    </EmptyState>
  {:else if !searchResults}
    <EmptyState>
      <span>{$_('searching')}</span>
    </EmptyState>
  {:else if !searchResults.length}
    <EmptyState>
      <span>{$_('stock_photos.not_found')}</span>
    </EmptyState>
  {:else}
    <SimpleImageGrid
      on:select={({ detail: { value } }) => {
        selectImage(searchResults.find(({ id }) => id === value));
      }}
    >
      {#each searchResults as { id, previewURL, description } (id)}
        <Option value={id}>
          <img loading="lazy" crossorigin="anonymous" src={previewURL} alt={description} />
        </Option>
      {/each}
    </SimpleImageGrid>
  {/if}
{:else}
  <EmptyState>
    <p>
      {@html DOMPurify.sanitize(
        $_('prefs.media.stock_photo.description', {
          values: {
            service: serviceLabel,
            homeHref: `href="${landingURL}"`,
            apiKeyHref: `href="${apiKeyURL}"`,
          },
        }),
        { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
      )}
    </p>
    <div class="key-input">
      <TextInput
        spellcheck="false"
        aria-label={$_('prefs.media.stock_photo.field_label', {
          values: { service: serviceLabel },
        })}
        on:input={({ target: { value } }) => {
          const _value = value.trim();

          if (apiKeyPattern && _value.match(apiKeyPattern)) {
            apiKey = _value;
            $prefs.apiKeys ||= {};
            $prefs.apiKeys[serviceId] = apiKey;

            if (apiKey) {
              _searchImages();
            }
          }
        }}
      />
    </div>
  </EmptyState>
{/if}

<style lang="scss">
  p {
    margin: 0 0 8px;
  }

  .key-input {
    width: 400px;
  }
</style>
