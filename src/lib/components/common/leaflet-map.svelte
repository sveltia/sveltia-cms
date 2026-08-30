<!--
  @component
  Implement a static map using Leaflet, showing a marker at the specified coordinates.
  @see https://leafletjs.com/
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { onMount } from 'svelte';

  import { getUnpkgURL, loadModule } from '$lib/services/app/dependencies';

  /**
   * @import Leaflet from 'leaflet';
   * @import { GeoCoordinates } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {GeoCoordinates} [coordinates] GeoCoordinates of the location to show on the map.
   * @property {string} [class] Additional CSS classes to apply to the map container.
   * @property {HTMLElement} [mapElement] The HTML element to bind the map to.
   * @property {(args: { leaflet: Leaflet, map: Leaflet.Map }) => void} [onReady] Callback function
   * invoked when the map is ready.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    coordinates,
    class: className = '',
    mapElement = $bindable(),
    onReady = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {ResizeObserver | undefined} */
  let resizeObserver;

  /**
   * Load the Leaflet library and initialize the map. We don’t bundle the library because of the
   * bundle size. The component may not be used often, and multiple map services, including Google
   * Maps and Here Maps, may be supported in the future.
   */
  const init = async () => {
    if (!mapElement) {
      return;
    }

    /** @type {Leaflet} */
    const leaflet = await loadModule('leaflet', 'dist/leaflet-src.esm.js');
    const iconUrl = `${getUnpkgURL('leaflet')}/dist/images/marker-icon-2x.png`;
    const map = leaflet.map(mapElement, { center: [0, 0], zoom: 2 });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        // Set the referrer policy explicitly to avoid issues when loading tiles from OpenStreetMap.
        // Otherwise, the global `same-origin` policy set in Sveltia CMS will apply.
        // @see https://github.com/sveltia/sveltia-cms/issues/742
        referrerPolicy: 'strict-origin',
      })
      .addTo(map);

    if (coordinates) {
      const { latitude, longitude } = coordinates;
      const icon = leaflet.icon({ iconUrl, iconSize: [25, 41] });

      leaflet.marker([latitude, longitude], { icon }).addTo(map);
      map.setView([latitude, longitude], 12);
    }

    mapElement.querySelectorAll('a[href^="https:"]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize();
    });

    resizeObserver.observe(mapElement);

    onReady?.({ leaflet, map });
  };

  onMount(() => {
    init();

    return () => {
      resizeObserver?.disconnect();
    };
  });
</script>

<div
  role="application"
  class="map {className}"
  bind:this={mapElement}
  aria-label={coordinates ? _('map_lat_lng', { values: coordinates }) : undefined}
  {...rest}
></div>

<style>
  /* Leaflet default styles copied from `node_modules/leaflet/dist/leaflet.css`. Somehow we can’t */
  /* import it directly here; Vite emits it as a separate CSS file, which we want to avoid. */
  /* Rules for the features we don’t use — popups, tooltips, the Layers and Scale controls, */
  /* image/video overlays, div icons, marker shadows, the Canvas renderer and the legacy IE/VML */
  /* hacks — have been dropped. */
  :global {
    .leaflet-pane,
    .leaflet-tile,
    .leaflet-marker-icon,
    .leaflet-tile-container,
    .leaflet-pane > svg,
    .leaflet-zoom-box,
    .leaflet-layer {
      position: absolute;
      left: 0;
      top: 0;
    }

    .leaflet-container {
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
      background: #ddd;
      outline-offset: 1px;
      font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    .leaflet-tile,
    .leaflet-marker-icon {
      -webkit-user-select: none;
      -moz-user-select: none;
      user-select: none;
      -webkit-user-drag: none;
    }

    .leaflet-tile::selection {
      background: transparent;
    }

    .leaflet-safari .leaflet-tile {
      image-rendering: -webkit-optimize-contrast;
    }

    .leaflet-safari .leaflet-tile-container {
      width: 1600px;
      height: 1600px;
      -webkit-transform-origin: 0 0;
      transform-origin: 0 0;
    }

    .leaflet-marker-icon {
      display: block;
    }

    .leaflet-container .leaflet-overlay-pane svg {
      max-width: none !important;
      max-height: none !important;
    }

    .leaflet-container .leaflet-marker-pane img,
    .leaflet-container .leaflet-tile-pane img,
    .leaflet-container .leaflet-tile {
      max-width: none !important;
      max-height: none !important;
      width: auto;
      padding: 0;
    }

    .leaflet-container img.leaflet-tile {
      mix-blend-mode: plus-lighter;
    }

    .leaflet-container.leaflet-touch-zoom {
      -ms-touch-action: pan-x pan-y;
      touch-action: pan-x pan-y;
    }

    .leaflet-container.leaflet-touch-drag {
      -ms-touch-action: pinch-zoom;
      touch-action: none;
      touch-action: pinch-zoom;
    }

    .leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
      -ms-touch-action: none;
      touch-action: none;
    }

    .leaflet-container a {
      -webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);
      color: #0078a8;
    }

    .leaflet-tile {
      filter: inherit;
      visibility: hidden;
    }

    .leaflet-tile-loaded {
      visibility: inherit;
    }

    .leaflet-zoom-box {
      width: 0;
      height: 0;
      -moz-box-sizing: border-box;
      box-sizing: border-box;
      z-index: 800;
      border: 2px dotted #38f;
      background: rgba(255, 255, 255, 0.5);
    }

    .leaflet-overlay-pane svg {
      -moz-user-select: none;
      user-select: none;
    }

    .leaflet-pane {
      z-index: 400;
    }

    .leaflet-tile-pane {
      z-index: 200;
    }

    .leaflet-overlay-pane {
      z-index: 400;
    }

    .leaflet-marker-pane {
      z-index: 600;
    }

    .leaflet-map-pane svg {
      z-index: 200;
    }

    .leaflet-control {
      position: relative;
      z-index: 800;
      pointer-events: visiblePainted;
      pointer-events: auto;
      float: left;
      clear: both;
      cursor: auto;
    }

    .leaflet-top,
    .leaflet-bottom {
      position: absolute;
      z-index: 1000;
      pointer-events: none;
    }

    .leaflet-top {
      top: 0;
    }

    .leaflet-right {
      right: 0;
    }

    .leaflet-bottom {
      bottom: 0;
    }

    .leaflet-left {
      left: 0;
    }

    .leaflet-right .leaflet-control {
      float: right;
      margin-right: 10px;
    }

    .leaflet-top .leaflet-control {
      margin-top: 10px;
    }

    .leaflet-bottom .leaflet-control {
      margin-bottom: 10px;
    }

    .leaflet-left .leaflet-control {
      margin-left: 10px;
    }

    .leaflet-zoom-animated {
      -webkit-transform-origin: 0 0;
      -ms-transform-origin: 0 0;
      transform-origin: 0 0;
    }

    svg.leaflet-zoom-animated {
      will-change: transform;
    }

    .leaflet-zoom-anim .leaflet-zoom-animated {
      -webkit-transition: -webkit-transform 0.25s cubic-bezier(0, 0, 0.25, 1);
      -moz-transition: -moz-transform 0.25s cubic-bezier(0, 0, 0.25, 1);
      transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1);
    }

    .leaflet-zoom-anim .leaflet-tile,
    .leaflet-pan-anim .leaflet-tile {
      -webkit-transition: none;
      -moz-transition: none;
      transition: none;
    }

    .leaflet-zoom-anim .leaflet-zoom-hide {
      visibility: hidden;
    }

    .leaflet-interactive {
      cursor: pointer;
    }

    .leaflet-grab {
      /* stylelint-disable-next-line declaration-property-value-no-unknown */
      cursor: -webkit-grab;
      /* stylelint-disable-next-line declaration-property-value-no-unknown */
      cursor: -moz-grab;
      cursor: grab;
    }

    .leaflet-crosshair,
    .leaflet-crosshair .leaflet-interactive {
      cursor: crosshair;
    }

    .leaflet-dragging .leaflet-grab,
    .leaflet-dragging .leaflet-grab .leaflet-interactive {
      cursor: move;
      /* stylelint-disable-next-line declaration-property-value-no-unknown */
      cursor: -webkit-grabbing;
      /* stylelint-disable-next-line declaration-property-value-no-unknown */
      cursor: -moz-grabbing;
      cursor: grabbing;
    }

    .leaflet-marker-icon,
    .leaflet-pane > svg path,
    .leaflet-tile-container {
      pointer-events: none;
    }

    .leaflet-marker-icon.leaflet-interactive,
    .leaflet-pane > svg path.leaflet-interactive {
      pointer-events: visiblePainted;
      pointer-events: auto;
    }

    .leaflet-bar {
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.65);
      border-radius: 4px;
    }

    .leaflet-bar a {
      background-color: #fff;
      background-position: 50% 50%;
      background-repeat: no-repeat;
      border-bottom: 1px solid #ccc;
      width: 26px;
      height: 26px;
      line-height: 26px;
      display: block;
      text-align: center;
      text-decoration: none;
      color: black;
    }

    .leaflet-bar a:hover,
    .leaflet-bar a:focus {
      background-color: #f4f4f4;
    }

    .leaflet-bar a:first-child {
      border-top-left-radius: 4px;
      border-top-right-radius: 4px;
    }

    .leaflet-bar a:last-child {
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      border-bottom: none;
    }

    .leaflet-bar a.leaflet-disabled {
      cursor: default;
      background-color: #f4f4f4;
      color: #bbb;
    }

    .leaflet-touch .leaflet-bar a {
      width: 30px;
      height: 30px;
      line-height: 30px;
    }

    .leaflet-touch .leaflet-bar a:first-child {
      border-top-left-radius: 2px;
      border-top-right-radius: 2px;
    }

    .leaflet-touch .leaflet-bar a:last-child {
      border-bottom-left-radius: 2px;
      border-bottom-right-radius: 2px;
    }

    .leaflet-control-zoom-in,
    .leaflet-control-zoom-out {
      font:
        bold 18px 'Lucida Console',
        Monaco,
        monospace;
      text-indent: 1px;
    }

    .leaflet-touch .leaflet-control-zoom-in,
    .leaflet-touch .leaflet-control-zoom-out {
      font-size: 22px;
    }

    .leaflet-container .leaflet-control-attribution {
      background: #fff;
      background: rgba(255, 255, 255, 0.8);
      margin: 0;
    }

    .leaflet-control-attribution {
      padding: 0 5px;
      color: #333;
      line-height: 1.4;
    }

    .leaflet-control-attribution a {
      text-decoration: none;
    }

    .leaflet-control-attribution a:hover,
    .leaflet-control-attribution a:focus {
      text-decoration: underline;
    }

    .leaflet-attribution-flag {
      display: inline !important;
      vertical-align: baseline !important;
      width: 1em;
      height: 0.6669em;
    }

    .leaflet-touch .leaflet-control-attribution,
    .leaflet-touch .leaflet-bar {
      box-shadow: none;
    }

    .leaflet-touch .leaflet-bar {
      border: 2px solid rgba(0, 0, 0, 0.2);
      background-clip: padding-box;
    }
  }

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

  /* Dark theme: https://stackoverflow.com/q/59819792 */
  :global(:root[data-theme='dark'] .leaflet-layer) {
    filter: invert(100%) hue-rotate(180deg);
  }
</style>
