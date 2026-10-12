<!--
  @component
  Implement the editor for a Map field.
  @see https://decapcms.org/docs/widgets/#Map
  @see https://sveltiacms.app/en/docs/fields/map
  @see https://leafletjs.com/
  @see https://github.com/JamesLMilner/terra-draw
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { AlertDialog, Button, Icon, Listbox, Option, SearchBar } from '@sveltia/ui';
  import { onDestroy, tick, untrack } from 'svelte';

  import LeafletMap from '$lib/components/common/leaflet-map.svelte';
  import { createMapDrawController } from '$lib/services/contents/fields/map/draw';
  import { searchLocations } from '$lib/services/contents/fields/map/geocoding';
  import {
    GeolocationUnsupportedError,
    getCurrentPosition,
  } from '$lib/services/contents/fields/map/geolocation';
  import { isValidGeoJSON, parseGeoJSON } from '$lib/services/contents/fields/map/helpers';
  import { watch, watchAsync } from '$lib/services/utils/state.svelte';

  /**
   * @import Leaflet from 'leaflet';
   * @import { MapDrawController } from '$lib/services/contents/fields/map/draw';
   * @import { LocationSearchResult } from '$lib/services/contents/fields/map/geocoding';
   * @import { FieldEditorProps, GeoCoordinates } from '$lib/types/private';
   * @import { MapField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MapField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value. Stringified GeoJSON geometry object.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue = $bindable(),
    // required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const { decimals = 7, type: geometryType = 'Point', center, zoom } = $derived(fieldConfig);

  /** @type {HTMLElement | undefined} */
  let mapElement = $state();
  /** @type {HTMLElement | undefined} */
  let toolbar = $state();
  /** @type {MapDrawController | undefined} */
  let draw = $state.raw(undefined);
  /** @type {string} */
  let inputValue = $state('');
  /** @type {string} */
  let searchQuery = $state('');
  /** @type {LocationSearchResult[] | undefined} */
  let searchResults = $state(undefined);
  /** @type {boolean} */
  let searching = $state(false);
  /** @type {boolean} */
  let showAlertDialog = $state(false);
  /** @type {string} */
  let errorMessage = $state('');

  /** Whether the component has been destroyed, possibly before the drawing tools are loaded. */
  let destroyed = false;

  /**
   * Start the drawing tools once the Leaflet map is ready.
   * @param {object} args Arguments.
   * @param {Leaflet} args.leaflet Leaflet library.
   * @param {Leaflet.Map} args.map Leaflet map instance.
   */
  const onReady = async ({ leaflet, map }) => {
    const controller = await createMapDrawController({
      leaflet,
      map,
      geometryType,
      decimals,
      /**
       * Take the value of a feature the user has drawn.
       * @param {string} value Stringified GeoJSON geometry.
       */
      onChange: (value) => {
        inputValue = value;
      },
      /**
       * Check whether the component has been destroyed while the libraries were loading.
       * @returns {boolean} Result.
       */
      isCancelled: () => destroyed,
    });

    // The component may have been destroyed, and the map removed, while the libraries were loading
    if (!controller) {
      return;
    }

    draw = controller;

    // The watcher below will handle fitting the map to an existing valid value. Apply the
    // configured center/zoom defaults here for the case where there is no valid value
    if (!currentValue || !isValidGeoJSON(currentValue, geometryType)) {
      controller.showDefaultView({ center, zoom });
    }
  };

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    if (!draw) {
      return;
    }

    // Validate the value
    const geometry = parseGeoJSON(currentValue ?? '', geometryType);
    const newValue = geometry ? /** @type {string} */ (currentValue) : '';

    if (inputValue === newValue) {
      return;
    }

    inputValue = newValue;
    draw.showGeometry(geometry);
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}.
   */
  const setCurrentValue = () => {
    if (!draw) {
      return;
    }

    const newValue = inputValue;

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  /**
   * Set the location on the map editor.
   * @param {GeoCoordinates} coordinates GeoCoordinates of the location to set.
   */
  const setLocation = (coordinates) => {
    /* v8 ignore next 3 -- the drawing tools are loaded right after the map, before any input */
    if (!draw) {
      return;
    }

    const value = draw.setLocation(coordinates);

    if (value !== undefined) {
      inputValue = value;
    }
  };

  /**
   * Handle the selection of a search result. Move the map to the selected location and add a point
   * feature to the map.
   * @param {LocationSearchResult} result Selected search result.
   */
  const onSearchResultSelect = ({ lat, lon }) => {
    setLocation({ latitude: parseFloat(lat), longitude: parseFloat(lon) });
  };

  /**
   * Use the browser’s geolocation API to get the current location of the user and set it as the
   * value of the map editor. This function is called when the Use Current Location button is
   * clicked. It retrieves the user’s current position and updates the map with a point feature at
   * the user’s location.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
   */
  const useCurrentLocation = async () => {
    /** @type {GeoCoordinates} */
    let coordinates;

    try {
      coordinates = await getCurrentPosition();
    } catch (error) {
      showAlertDialog = true;

      if (error instanceof GeolocationUnsupportedError) {
        errorMessage = _('geolocation_unsupported');
      } else {
        errorMessage = _('geolocation_error_body');
        // eslint-disable-next-line no-console
        console.error('Error getting current location:', error);
      }

      return;
    }

    setLocation(coordinates);
  };

  /**
   * Clear the current value of the map editor. This is called when the Clear button is clicked.
   * It sets the `currentValue` to an empty string, effectively clearing the map. The Clear button
   * is then disabled, which would drop its focus, so the place search box takes it.
   */
  const clearValue = async () => {
    currentValue = '';
    await tick();
    /** @type {HTMLInputElement} */ (
      /** @type {HTMLElement} */ (toolbar).querySelector('input')
    ).focus();
  };

  onDestroy(() => {
    destroyed = true;
    draw?.stop();
  });

  watch(
    () => [draw, currentValue],
    () => {
      setInputValue();
    },
  );

  watch(
    () => inputValue,
    () => {
      setCurrentValue();
    },
  );

  // Search for locations matching the query. The debounced search bar can send another query
  // before the results for the previous one arrive, which `watchAsync` takes care of
  watchAsync(
    () => {
      const query = searchQuery;

      if (!query.trim()) {
        searching = false;

        return undefined;
      }

      searching = true;

      return untrack(() => searchLocations(query));
    },
    (results) => {
      searchResults = results;
      searching = false;
    },
  );
</script>

<div role="none" class="toolbar" bind:this={toolbar}>
  <!-- @todo Replace this with `<Combobox>` -->
  <SearchBar
    bind:value={searchQuery}
    debounce
    {readonly}
    flex
    placeholder={_('find_place')}
    aria-label={_('find_place')}
  />
  <!-- @todo Replace `title` with a native tooltip -->
  <Button
    variant="tertiary"
    iconic
    title={_('use_your_location')}
    aria-label={_('use_your_location')}
    disabled={readonly}
    onclick={() => {
      useCurrentLocation();
    }}
  >
    {#snippet startIcon()}
      <Icon name="near_me" />
    {/snippet}
  </Button>
  <Button
    variant="tertiary"
    label={_('clear')}
    disabled={readonly || !currentValue}
    onclick={() => {
      clearValue();
    }}
  />
</div>

{#if searching}
  <div role="alert" class="search-result searching">{_('searching')}</div>
{:else if searchQuery}
  {#if searchResults}
    {#if searchResults.length}
      <Listbox ariaLabel={_('search_results')}>
        {#each searchResults as result (result.place_id)}
          <Option
            label={result.display_name}
            onSelect={() => {
              onSearchResultSelect(result);
            }}
          />
        {/each}
      </Listbox>
    {:else}
      <div role="alert" class="search-result no-result">{_('no_results')}</div>
    {/if}
  {/if}
{/if}

<div class="map-wrapper">
  <LeafletMap bind:mapElement inert={readonly} class={invalid ? 'invalid' : undefined} {onReady} />
</div>

<AlertDialog bind:open={showAlertDialog} title={_('geolocation_error_title')}>
  {errorMessage}
</AlertDialog>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    margin-bottom: var(--sui-spacing-2x);
  }

  .search-result {
    padding: 12px;
    color: var(--sui-secondary-foreground-color);
  }

  .map-wrapper {
    display: contents;

    :global {
      .map {
        aspect-ratio: auto;
        height: 400px;

        &.invalid {
          border-color: var(--sui-error-border-color);
        }
      }
    }
  }
</style>
