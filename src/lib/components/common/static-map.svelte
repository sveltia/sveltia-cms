<!--
  @component
  Implement a static map using Leaflet, showing a marker at the specified coordinates.
  @see https://leafletjs.com/
-->
<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import { getUnpkgURL, loadModule } from '$lib/services/app/dependencies';

  /**
   * @import { GeoCoordinates } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {GeoCoordinates} coordinates GeoCoordinates of the location to show on the map.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    coordinates,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let mapElement = $state();

  /** @type {import('leaflet').Map | undefined} */
  let map = undefined;

  /**
   * Load the Leaflet library and initialize the map. We don’t bundle the library because of the
   * bundle size. The component may not be used often, and multiple map services, including Google
   * Maps and Here Maps, may be supported in the future.
   */
  const init = async () => {
    if (!mapElement) {
      return;
    }

    /** @type {import('leaflet')} */
    const leaflet = await loadModule('leaflet', 'dist/leaflet-src.esm.js');
    const iconUrl = `${getUnpkgURL('leaflet')}/dist/images/marker-icon-2x.png`;

    map = leaflet.map(mapElement, { center: [0, 0], zoom: 2 });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      .addTo(map);

    const { latitude, longitude } = coordinates;
    const icon = leaflet.icon({ iconUrl, iconSize: [25, 41] });

    leaflet.marker([latitude, longitude], { icon }).addTo(map);
    map.setView([latitude, longitude], 12);

    mapElement.querySelectorAll('a[href^="https:"]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    new ResizeObserver(() => {
      map?.invalidateSize();
    }).observe(mapElement);
  };

  onMount(() => {
    init();
  });
</script>

<div
  role="application"
  class="map"
  bind:this={mapElement}
  aria-label={$_('map_lat_lng', { values: coordinates })}
></div>

<style lang="scss">
  // @todo Copy minimal styles from Leaflet to avoid loading the whole CSS file
  @import 'node_modules/leaflet/dist/leaflet.css';

  .map {
    margin: var(--sui-focus-ring-width);
    border: 1px solid var(--sui-textbox-border-color);
    border-radius: var(--sui-textbox-border-radius);
    overflow: hidden;
    aspect-ratio: 1 / 1;
    background-clip: text;
  }

  :global(.leaflet-container) {
    font-family: inherit !important;
    font-size: var(--sui-font-size-small) !important;
  }

  :global(.leaflet-container a) {
    color: var(--sui-primary-accent-color-text) !important;
    text-decoration: none !important;
  }

  :global(.leaflet-bar a) {
    border-color: var(--sui-button-border-color) !important;
    color: var(--sui-secondary-foreground-color) !important;
    background-color: var(--sui-button-background-color) !important;
  }

  :global(.leaflet-control) {
    color: var(--sui-secondary-foreground-color) !important;
    background-color: var(--sui-secondary-background-color-translucent) !important;
  }

  :global(.leaflet-control-attribution) {
    padding: 4px 8px;
  }

  // Dark theme: https://stackoverflow.com/q/59819792
  :global(:root[data-theme='dark'] .leaflet-layer) {
    filter: invert(100%) hue-rotate(180deg);
  }
</style>
