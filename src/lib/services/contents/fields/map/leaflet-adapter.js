/**
 * @import Leaflet from 'leaflet';
 * @import {
 * GeoJSONStoreFeatures,
 * SetCursor,
 * TerraDrawAdapterStyling,
 * TerraDrawChanges,
 * TerraDrawExtend,
 * TerraDrawStylingFunction,
 * } from 'terra-draw';
 */

/**
 * The z-index of the Leaflet pane holding the features drawn at z-index 0, above the built-in
 * panes, like the marker pane at 600.
 */
const BASE_PANE_Z_INDEX = 600;

/**
 * Create a Terra Draw adapter for a Leaflet map, based on `terra-draw-leaflet-adapter`, which isn’t
 * loaded from UNPKG: its `?module` URL loads another copy of Terra Draw for the bare import, while
 * the later versions import Leaflet’s default export, which UNPKG fails to provide.
 * @param {object} args Arguments.
 * @param {typeof TerraDrawExtend} args.TerraDrawExtend `TerraDrawExtend` namespace of the loaded
 * Terra Draw module, providing the base adapter class.
 * @param {Leaflet} args.leaflet Leaflet library.
 * @param {Leaflet.Map} args.map Leaflet map.
 * @returns {TerraDrawExtend.TerraDrawBaseAdapter} Adapter.
 * @see https://github.com/JamesLMilner/terra-draw/tree/main/packages/terra-draw-leaflet-adapter
 * @see https://github.com/sveltia/sveltia-cms/issues/540
 */
export const createLeafletAdapter = ({ TerraDrawExtend, leaflet, map }) => {
  /**
   * Terra Draw adapter for Leaflet.
   */
  class LeafletAdapter extends TerraDrawExtend.TerraDrawBaseAdapter {
    /**
     * Leaflet map.
     */
    #map = map;

    /**
     * Leaflet layers of the features on the map, keyed with the feature ID.
     * @type {Map<string, Leaflet.GeoJSON>}
     */
    #layers = new Map();

    /**
     * Get the styles of a feature, creating the Leaflet pane for its z-index if needed, so the
     * features are stacked in the order Terra Draw expects.
     * @param {TerraDrawStylingFunction} styling Styling functions keyed with the draw mode.
     * @param {GeoJSON.Feature | undefined} feature Feature.
     * @returns {{ styles: TerraDrawAdapterStyling, pane: string }} Styles and pane name.
     */
    #getStyles(styling, feature) {
      const _feature = /** @type {GeoJSONStoreFeatures} */ (feature);
      const styles = styling[/** @type {string} */ (_feature.properties.mode)](_feature);
      const pane = `terra-draw-${styles.zIndex}`;

      if (!this.#map.getPane(pane)) {
        this.#map.createPane(pane).style.zIndex = String(BASE_PANE_Z_INDEX + styles.zIndex);
      }

      return { styles, pane };
    }

    /**
     * Add a Leaflet layer for a feature, replacing the existing one, if any.
     * @param {GeoJSON.GeoJsonObject} data Feature, or a feature collection exported from an
     * existing layer.
     * @param {string} id Feature ID.
     * @param {TerraDrawStylingFunction} styling Styling functions keyed with the draw mode.
     */
    #addLayer(data, id, styling) {
      this.#removeLayer(id);

      const layer = leaflet.geoJSON(data, {
        /**
         * Draw a point as a circle.
         * @param {GeoJSON.Feature} feature Point feature.
         * @param {Leaflet.LatLng} latlng Coordinates.
         * @returns {Leaflet.CircleMarker} Circle.
         */
        pointToLayer: (feature, latlng) => {
          const { styles, pane } = this.#getStyles(styling, feature);

          return leaflet.circleMarker(latlng, {
            radius: styles.pointWidth,
            stroke: !!styles.pointOutlineWidth,
            color: styles.pointOutlineColor,
            weight: styles.pointOutlineWidth,
            opacity: styles.pointOutlineOpacity ?? 1,
            fillColor: styles.pointColor,
            fillOpacity: styles.pointOpacity ?? 1,
            pane,
            interactive: false,
          });
        },
        /**
         * Get the styles of a line or polygon. A point is styled in `pointToLayer`.
         * @param {GeoJSON.Feature | undefined} feature Feature.
         * @returns {Leaflet.PathOptions} Styles.
         */
        style: (feature) => {
          const { type } = /** @type {GeoJSON.Feature} */ (feature).geometry;

          // Leaflet applies these styles to the circles of points as well
          if (type === 'Point') {
            return {};
          }

          const { styles, pane } = this.#getStyles(styling, feature);

          if (type === 'LineString') {
            return {
              color: styles.lineStringColor,
              weight: styles.lineStringWidth,
              opacity: styles.lineStringOpacity ?? 1,
              pane,
              interactive: false,
            };
          }

          return {
            stroke: true,
            color: styles.polygonOutlineColor,
            weight: styles.polygonOutlineWidth,
            opacity: styles.polygonOutlineOpacity ?? 1,
            fillColor: styles.polygonFillColor,
            fillOpacity: styles.polygonFillOpacity,
            pane,
            interactive: false,
          };
        },
      });

      this.#layers.set(id, layer);
      this.#map.addLayer(layer);
    }

    /**
     * Remove the Leaflet layer of a feature, if any.
     * @param {string} id Feature ID.
     */
    #removeLayer(id) {
      const layer = this.#layers.get(id);

      if (layer) {
        this.#map.removeLayer(layer);
        this.#layers.delete(id);
      }
    }

    /**
     * Get the coordinates of the given pointer event on the map.
     * @param {PointerEvent | MouseEvent} event Event.
     * @returns {{ lng: number, lat: number } | null} Coordinates, or `null` if they can’t be
     * determined.
     */
    getLngLatFromEvent(event) {
      const { containerX, containerY } = this.getMapElementXYPosition(event);
      const { lng, lat } = this.unproject(containerX, containerY);

      return Number.isNaN(lng) || Number.isNaN(lat) ? null : { lng, lat };
    }

    /**
     * Get the element that handles the interaction events.
     * @returns {HTMLElement} Map container.
     */
    getMapEventElement() {
      return this.#map.getContainer();
    }

    /**
     * Enable or disable dragging the map.
     * @param {boolean} enabled Whether to enable it.
     */
    setDraggability(enabled) {
      this.#map.dragging[enabled ? 'enable' : 'disable']();
    }

    /**
     * Enable or disable zooming the map with a double click.
     * @param {boolean} enabled Whether to enable it.
     */
    setDoubleClickToZoom(enabled) {
      this.#map.doubleClickZoom[enabled ? 'enable' : 'disable']();
    }

    /**
     * Convert coordinates to a position in the map container.
     * @param {number} lng Longitude.
     * @param {number} lat Latitude.
     * @returns {{ x: number, y: number }} Position.
     */
    project(lng, lat) {
      const { x, y } = this.#map.latLngToContainerPoint({ lng, lat });

      return { x, y };
    }

    /**
     * Convert a position in the map container to coordinates.
     * @param {number} x X position.
     * @param {number} y Y position.
     * @returns {{ lng: number, lat: number }} Coordinates.
     */
    unproject(x, y) {
      const { lng, lat } = this.#map.containerPointToLatLng([x, y]);

      return { lng, lat };
    }

    /**
     * Set the cursor of the map container.
     * @param {Parameters<SetCursor>[0]} cursor CSS cursor, or `unset` to remove it.
     */
    setCursor(cursor) {
      const { style } = this.getMapEventElement();

      if (cursor === 'unset') {
        style.removeProperty('cursor');
      } else {
        style.cursor = cursor;
      }
    }

    /**
     * Render the changed features on the map.
     * @param {TerraDrawChanges} changes Created, updated and deleted features.
     * @param {TerraDrawStylingFunction} styling Styling functions keyed with the draw mode.
     */
    render({ created, updated, deletedIds }, styling) {
      deletedIds.forEach((id) => this.#removeLayer(String(id)));

      [...created, ...updated].forEach((feature) => {
        // The ID is always set, but the type allows it to be missing
        if (feature.id !== undefined) {
          this.#addLayer(feature, String(feature.id), styling);
        }
      });

      // Without any change, only the styles have changed: redraw every feature. Deferred, as the
      // styles of a single feature are otherwise not updated, according to the original adapter
      if (!created.length && !updated.length && !deletedIds.length) {
        globalThis.setTimeout(() => {
          // Copy the entries, as re-adding a key while iterating a `Map` visits it again
          [...this.#layers].forEach(([id, layer]) => {
            this.#addLayer(layer.toGeoJSON(), id, styling);
          });
        });
      }
    }

    /**
     * Clear the features from the store and the map.
     */
    clear() {
      if (this._currentModeCallbacks) {
        this._currentModeCallbacks.onClear();
        [...this.#layers.keys()].forEach((id) => this.#removeLayer(id));
      }
    }

    /**
     * Register the callbacks of the current mode, and tell Terra Draw the adapter is ready.
     * @param {Parameters<TerraDrawExtend.TerraDrawBaseAdapter['register']>[0]} callbacks
     * Callbacks.
     */
    register(callbacks) {
      super.register(callbacks);
      this._currentModeCallbacks?.onReady?.();
    }
  }

  return new LeafletAdapter({});
};
