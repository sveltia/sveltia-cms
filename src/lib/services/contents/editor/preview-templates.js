import { createElement } from 'react';
import { mount, unmount } from 'svelte';

import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
import {
  buildPreviewData,
  convertEntryToMap,
  getAssociatedPreviewAssets,
} from '$lib/services/api/helpers';
import { getImmutable } from '$lib/services/api/immutable';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { createEntryDraftMountContext } from '$lib/services/contents/draft/state.svelte';
import { getField } from '$lib/services/contents/entry/fields';
import { unflattenMap } from '$lib/services/utils/object';

/**
 * @import { MapOf } from 'immutable';
 * @import { ReactElement } from 'react';
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { Entry, EntryDraft, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * ApiEntry,
 * CustomPreviewTemplateProps,
 * Field,
 * FieldKeyPath,
 * RawEntryContent,
 * } from '$lib/types/public';
 */

/**
 * Create a field preview mounting function.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Entry draft state of the editor. The mounted component
 * is outside the Svelte component tree, so the state has to be passed to it as a mount context.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for getField function.
 * @returns {(target: HTMLElement, keyPath: FieldKeyPath) => Record<string, any>} Function that
 * mounts a field preview component.
 */
export const createFieldPreviewMounter =
  ({ entryDraft, locale, getFieldArgs }) =>
  /**
   * Mount a Svelte component for field preview.
   * @param {HTMLElement} target The DOM element to mount the Svelte component into.
   * @param {FieldKeyPath} keyPath The key path of the field to preview.
   * @returns {Record<string, any>} The mounted Svelte component instance.
   */
  (target, keyPath) =>
    mount(FieldPreview, {
      target,
      context: createEntryDraftMountContext(entryDraft),
      props: {
        keyPath,
        typedKeyPath: '',
        locale,
        fieldConfig: /** @type {Field} */ (getField({ ...getFieldArgs, keyPath })),
        showLabel: false,
      },
    });

/**
 * Create a widget preview function for React preview templates.
 * @param {(target: HTMLElement, keyPath: FieldKeyPath) => Record<string, any>} mountComponent
 * Function to mount Svelte components for field preview.
 * @returns {(keyPath: string) => ReactElement} Function that creates widget preview components.
 */
export const createWidgetFor =
  (mountComponent) =>
  /**
   * Get a widget preview component for a field.
   * @param {string} keyPath Field key path.
   * @returns {ReactElement} Widget preview. It’s a React element that renders a Svelte component
   * inside a div.
   */
  (keyPath) => {
    /** @type {Record<string, any>} */
    let component;

    /**
     * Mount or unmount the Svelte component when the div is added or removed from the DOM.
     * @param {HTMLElement | null} div The div element to mount the Svelte component into.
     */
    const ref = (div) => {
      if (div) {
        component = mountComponent(div, keyPath);
      } else if (component) {
        unmount(component);
      }
    };

    return createElement('div', { ref });
  };

/**
 * Create widgets map for an object value.
 * @param {Record<string, any>} obj Object value.
 * @param {string} basePath Base key path.
 * @param {(keyPath: string) => ReactElement} widgetFor Function to create widget previews.
 * @returns {MapOf<any>} Immutable Map of widgets.
 */
export const createWidgetsMap = (obj, basePath, widgetFor) =>
  getImmutable().Map(
    Object.fromEntries(Object.keys(obj).map((key) => [key, widgetFor(`${basePath}.${key}`)])),
  );

/**
 * Create a widgetsFor function.
 * @param {RawEntryContent} content Unflattened entry content.
 * @param {(keyPath: string) => ReactElement} widgetFor Function to create widget previews.
 * @returns {(name: string) => any} Function that gets widgets data structure for a field.
 */
export const createWidgetsFor =
  (content, widgetFor) =>
  /**
   * Get widgets data structure for a given field name. For list fields, returns an array of
   * ImmutableMaps; for object fields, returns a single ImmutableMap. Each map has `data` and
   * `widgets` keys containing the field values. Returns the raw value for primitives and `null`/
   * `undefined` for missing or null fields.
   * @param {string} name Field name.
   * @returns {any} Widgets data structure.
   */
  (name) => {
    const value = content[name];

    if (value === null || value === undefined) {
      return value;
    }

    const { fromJS, Map: ImmutableMap } = getImmutable();

    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const isObject = typeof item === 'object' && item !== null;

        return ImmutableMap({
          data: fromJS(item),
          widgets: isObject
            ? createWidgetsMap(item, `${name}.${index}`, widgetFor)
            : ImmutableMap({}),
        });
      });
    }

    if (typeof value === 'object') {
      return ImmutableMap({
        data: fromJS(value),
        widgets: createWidgetsMap(value, name, widgetFor),
      });
    }

    return value;
  };

/**
 * Get entries from a collection. If `slug` is provided, returns the entry with the matching slug;
 * otherwise, returns all entries.
 * @param {string} name Collection name.
 * @param {string} [slug] Optional entry slug to filter by.
 * @returns {Promise<(MapOf<ApiEntry>[] | MapOf<ApiEntry>)>} Collection entries.
 */
export const getCollectionByName = async (name, slug) => {
  const collection = getCollection(name);

  if (!collection) {
    throw new Error(`Collection "${name}" not found`);
  }

  const { defaultLocale } = collection._i18n;
  const entries = getEntriesByCollection(name);

  const convertArgs = {
    locale: defaultLocale,
    collectionName: name,
    associatedAssets: getAssociatedPreviewAssets({ collectionName: name }),
  };

  /**
   * Convert an entry to an Immutable Map with unflattened content and the same metadata shape as
   * other entry maps.
   * @param {Entry | undefined} entry Entry object to convert.
   * @returns {MapOf<ApiEntry>} Immutable Map of entry data.
   */
  const convertEntry = (entry) => convertEntryToMap({ ...convertArgs, entry });

  if (slug) {
    return convertEntry(entries.find((entry) => entry.slug === slug));
  }

  return entries.map(convertEntry);
};

/**
 * Prepare props for a custom preview template React component. The `document` and `window` props
 * should be provided by the iframe wrapper.
 * @param {object} options Options.
 * @param {EntryDraftState} options.entryDraft Entry draft state of the editor, used by the field
 * previews mounted by `widgetFor()`.
 * @param {EntryDraft} options.draft Snapshot of the entry draft being previewed.
 * @param {InternalLocaleCode} options.locale Current locale.
 * @returns {Omit<CustomPreviewTemplateProps, 'document' | 'window'>} Props for the React component
 * without `document` and `window`.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
export const preparePreviewTemplateProps = ({ entryDraft, draft, locale }) => {
  const { entryMap, valueMap, getFieldArgs, fieldsMetaData, getAsset } = buildPreviewData({
    draft,
    locale,
  });

  // Create factory functions with bound dependencies
  const mountFieldPreview = createFieldPreviewMounter({ entryDraft, locale, getFieldArgs });
  const widgetFor = createWidgetFor(mountFieldPreview);

  return {
    entry: entryMap,
    widgetFor,
    widgetsFor: createWidgetsFor(unflattenMap(valueMap), widgetFor),
    getAsset,
    getCollection: getCollectionByName,
    fieldsMetaData,
    // There are some undocumented props in Netlify/Decap CMS that Sveltia CMS doesn’t implement:
    // boundGetAsset, collection, config, isLoadingAsset, locale, onFieldClick, fields, state
  };
};
