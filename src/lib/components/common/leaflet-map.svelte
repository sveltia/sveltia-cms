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

    new ResizeObserver(() => {
      map?.invalidateSize();
    }).observe(mapElement);

    onReady?.({ leaflet, map });
  };

  onMount(() => {
    init();
  });
</script>

<div
  role="application"
  class="map {className}"
  bind:this={mapElement}
  aria-label={coordinates ? $_('map_lat_lng', { values: coordinates }) : undefined}
  {...rest}
></div>

<style lang="scss">
  // Leaflet default styles copied from `node_modules/leaflet/dist/leaflet.css`. Somehow we cannot
  // import it directly here; Vite emits it as a separate CSS file, which we want to avoid.
  // @todo Remove unused rules.
  :global {
    .leaflet-pane,
    .leaflet-tile,
    .leaflet-marker-icon,
    .leaflet-marker-shadow,
    .leaflet-tile-container,
    .leaflet-pane > svg,
    .leaflet-pane > canvas,
    .leaflet-zoom-box,
    .leaflet-image-layer,
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
    .leaflet-marker-icon,
    .leaflet-marker-shadow {
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

    .leaflet-marker-icon,
    .leaflet-marker-shadow {
      display: block;
    }

    .leaflet-container .leaflet-overlay-pane svg {
      max-width: none !important;
      max-height: none !important;
    }

    .leaflet-container .leaflet-marker-pane img,
    .leaflet-container .leaflet-shadow-pane img,
    .leaflet-container .leaflet-tile-pane img,
    .leaflet-container img.leaflet-image-layer,
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

    .leaflet-shadow-pane {
      z-index: 500;
    }

    .leaflet-marker-pane {
      z-index: 600;
    }

    .leaflet-tooltip-pane {
      z-index: 650;
    }

    .leaflet-popup-pane {
      z-index: 700;
    }

    .leaflet-map-pane canvas {
      z-index: 100;
    }

    .leaflet-map-pane svg {
      z-index: 200;
    }

    .leaflet-vml-shape {
      width: 1px;
      height: 1px;
    }

    .lvml {
      behavior: url(#default#VML);
      display: inline-block;
      position: absolute;
    }

    .leaflet-control {
      position: relative;
      z-index: 800;
      pointer-events: visiblePainted;
      pointer-events: auto;
      float: left;
      clear: both;
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

    .leaflet-fade-anim .leaflet-popup {
      opacity: 0;
      -webkit-transition: opacity 0.2s linear;
      -moz-transition: opacity 0.2s linear;
      transition: opacity 0.2s linear;
    }

    .leaflet-fade-anim .leaflet-map-pane .leaflet-popup {
      opacity: 1;
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
      cursor: -webkit-grab;
      cursor: -moz-grab;
      cursor: grab;
    }

    .leaflet-crosshair,
    .leaflet-crosshair .leaflet-interactive {
      cursor: crosshair;
    }

    .leaflet-popup-pane,
    .leaflet-control {
      cursor: auto;
    }

    .leaflet-dragging .leaflet-grab,
    .leaflet-dragging .leaflet-grab .leaflet-interactive,
    .leaflet-dragging .leaflet-marker-draggable {
      cursor: move;
      cursor: -webkit-grabbing;
      cursor: -moz-grabbing;
      cursor: grabbing;
    }

    .leaflet-marker-icon,
    .leaflet-marker-shadow,
    .leaflet-image-layer,
    .leaflet-pane > svg path,
    .leaflet-tile-container {
      pointer-events: none;
    }

    .leaflet-marker-icon.leaflet-interactive,
    .leaflet-image-layer.leaflet-interactive,
    .leaflet-pane > svg path.leaflet-interactive,
    svg.leaflet-image-layer.leaflet-interactive path {
      pointer-events: visiblePainted;
      pointer-events: auto;
    }

    .leaflet-bar {
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.65);
      border-radius: 4px;
    }

    .leaflet-bar a {
      background-color: #fff;
      border-bottom: 1px solid #ccc;
      width: 26px;
      height: 26px;
      line-height: 26px;
      display: block;
      text-align: center;
      text-decoration: none;
      color: black;
    }

    .leaflet-bar a,
    .leaflet-control-layers-toggle {
      background-position: 50% 50%;
      background-repeat: no-repeat;
      display: block;
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

    .leaflet-control-layers {
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
      background: #fff;
      border-radius: 5px;
    }

    .leaflet-control-layers-toggle {
      background-image: url(images/layers.png);
      width: 36px;
      height: 36px;
    }

    .leaflet-retina .leaflet-control-layers-toggle {
      background-image: url(images/layers-2x.png);
      background-size: 26px 26px;
    }

    .leaflet-touch .leaflet-control-layers-toggle {
      width: 44px;
      height: 44px;
    }

    .leaflet-control-layers .leaflet-control-layers-list,
    .leaflet-control-layers-expanded .leaflet-control-layers-toggle {
      display: none;
    }

    .leaflet-control-layers-expanded .leaflet-control-layers-list {
      display: block;
      position: relative;
    }

    .leaflet-control-layers-expanded {
      padding: 6px 10px 6px 6px;
      color: #333;
      background: #fff;
    }

    .leaflet-control-layers-scrollbar {
      overflow-y: scroll;
      overflow-x: hidden;
      padding-right: 5px;
    }

    .leaflet-control-layers-selector {
      margin-top: 2px;
      position: relative;
      top: 1px;
    }

    .leaflet-control-layers label {
      display: block;
      font-size: 13px;
      font-size: 1.08333em;
    }

    .leaflet-control-layers-separator {
      height: 0;
      border-top: 1px solid #ddd;
      margin: 5px -10px 5px -6px;
    }

    .leaflet-default-icon-path {
      background-image: url(images/marker-icon.png);
    }

    .leaflet-container .leaflet-control-attribution {
      background: #fff;
      background: rgba(255, 255, 255, 0.8);
      margin: 0;
    }

    .leaflet-control-attribution,
    .leaflet-control-scale-line {
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

    .leaflet-left .leaflet-control-scale {
      margin-left: 5px;
    }

    .leaflet-bottom .leaflet-control-scale {
      margin-bottom: 5px;
    }

    .leaflet-control-scale-line {
      border: 2px solid #777;
      border-top: none;
      line-height: 1.1;
      padding: 2px 5px 1px;
      white-space: nowrap;
      -moz-box-sizing: border-box;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.8);
      text-shadow: 1px 1px #fff;
    }

    .leaflet-control-scale-line:not(:first-child) {
      border-top: 2px solid #777;
      border-bottom: none;
      margin-top: -2px;
    }

    .leaflet-control-scale-line:not(:first-child):not(:last-child) {
      border-bottom: 2px solid #777;
    }

    .leaflet-touch .leaflet-control-attribution,
    .leaflet-touch .leaflet-control-layers,
    .leaflet-touch .leaflet-bar {
      box-shadow: none;
    }

    .leaflet-touch .leaflet-control-layers,
    .leaflet-touch .leaflet-bar {
      border: 2px solid rgba(0, 0, 0, 0.2);
      background-clip: padding-box;
    }

    .leaflet-popup {
      position: absolute;
      text-align: center;
      margin-bottom: 20px;
    }

    .leaflet-popup-content-wrapper {
      padding: 1px;
      text-align: left;
      border-radius: 12px;
    }

    .leaflet-popup-content {
      margin: 13px 24px 13px 20px;
      line-height: 1.3;
      font-size: 13px;
      font-size: 1.08333em;
      min-height: 1px;
    }

    .leaflet-popup-content p {
      margin: 17px 0;
      margin: 1.3em 0;
    }

    .leaflet-popup-tip-container {
      width: 40px;
      height: 20px;
      position: absolute;
      left: 50%;
      margin-top: -1px;
      margin-left: -20px;
      overflow: hidden;
      pointer-events: none;
    }

    .leaflet-popup-tip {
      width: 17px;
      height: 17px;
      padding: 1px;

      margin: -10px auto 0;
      pointer-events: auto;

      -webkit-transform: rotate(45deg);
      -moz-transform: rotate(45deg);
      -ms-transform: rotate(45deg);
      transform: rotate(45deg);
    }

    .leaflet-popup-content-wrapper,
    .leaflet-popup-tip {
      background: white;
      color: #333;
      box-shadow: 0 3px 14px rgba(0, 0, 0, 0.4);
    }

    .leaflet-container a.leaflet-popup-close-button {
      position: absolute;
      top: 0;
      right: 0;
      border: none;
      text-align: center;
      width: 24px;
      height: 24px;
      font:
        16px/24px Tahoma,
        Verdana,
        sans-serif;
      color: #757575;
      text-decoration: none;
      background: transparent;
    }

    .leaflet-container a.leaflet-popup-close-button:hover,
    .leaflet-container a.leaflet-popup-close-button:focus {
      color: #585858;
    }

    .leaflet-popup-scrolled {
      overflow: auto;
    }

    .leaflet-oldie .leaflet-popup-content-wrapper {
      -ms-zoom: 1;
      zoom: 1;
    }

    .leaflet-oldie .leaflet-popup-tip {
      width: 24px;
      margin: 0 auto;
    }

    .leaflet-oldie .leaflet-control-zoom,
    .leaflet-oldie .leaflet-control-layers,
    .leaflet-oldie .leaflet-popup-content-wrapper,
    .leaflet-oldie .leaflet-popup-tip {
      border: 1px solid #999;
    }

    .leaflet-div-icon {
      background: #fff;
      border: 1px solid #666;
    }

    .leaflet-tooltip {
      position: absolute;
      padding: 6px;
      background-color: #fff;
      border: 1px solid #fff;
      border-radius: 3px;
      color: #222;
      white-space: nowrap;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .leaflet-tooltip.leaflet-interactive {
      cursor: pointer;
      pointer-events: auto;
    }

    .leaflet-tooltip-top:before,
    .leaflet-tooltip-bottom:before,
    .leaflet-tooltip-left:before,
    .leaflet-tooltip-right:before {
      position: absolute;
      pointer-events: none;
      border: 6px solid transparent;
      background: transparent;
      content: '';
    }

    .leaflet-tooltip-bottom {
      margin-top: 6px;
    }

    .leaflet-tooltip-top {
      margin-top: -6px;
    }

    .leaflet-tooltip-bottom:before,
    .leaflet-tooltip-top:before {
      left: 50%;
      margin-left: -6px;
    }

    .leaflet-tooltip-top:before {
      bottom: 0;
      margin-bottom: -12px;
      border-top-color: #fff;
    }

    .leaflet-tooltip-bottom:before {
      top: 0;
      margin-top: -12px;
      margin-left: -6px;
      border-bottom-color: #fff;
    }

    .leaflet-tooltip-left {
      margin-left: -6px;
    }

    .leaflet-tooltip-right {
      margin-left: 6px;
    }

    .leaflet-tooltip-left:before,
    .leaflet-tooltip-right:before {
      top: 50%;
      margin-top: -6px;
    }

    .leaflet-tooltip-left:before {
      right: 0;
      margin-right: -12px;
      border-left-color: #fff;
    }

    .leaflet-tooltip-right:before {
      left: 0;
      margin-left: -12px;
      border-right-color: #fff;
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

  // Dark theme: https://stackoverflow.com/q/59819792
  :global(:root[data-theme='dark'] .leaflet-layer) {
    filter: invert(100%) hue-rotate(180deg);
  }
</style>
