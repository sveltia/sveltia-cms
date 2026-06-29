import { unflatten } from 'flat';
import { fromJS, Map as ImmutableMap } from 'immutable';
import { createElement } from 'react';
import { mount, unmount } from 'svelte';
import { get } from 'svelte/store';

import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
import { allAssets, getAssetByPath, isAssetInFolder } from '$lib/services/assets';
import { getAssetFolder } from '$lib/services/assets/folders';
import { AssetProxy } from '$lib/services/contents/api/asset-proxy';
import { createEntryMap } from '$lib/services/contents/api/entries';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { MapOf } from 'immutable';
 * @import { ReactElement } from 'react';
 * @import { Entry, EntryDraft, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * ApiAsset,
 * CustomPreviewTemplateProps,
 * Field,
 * FieldKeyPath,
 * RawEntryContent,
 * } from '$lib/types/public';
 */

/**
 * Create a field preview mounting function.
 * @internal
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for getField function.
 * @returns {(target: HTMLElement, keyPath: FieldKeyPath) => Record<string, any>} Function that
 * mounts a field preview component.
 */
export const createFieldPreviewMounter =
  ({ locale, getFieldArgs }) =>
  /**
   * Mount a Svelte component for field preview.
   * @param {HTMLElement} target The DOM element to mount the Svelte component into.
   * @param {FieldKeyPath} keyPath The key path of the field to preview.
   * @returns {Record<string, any>} The mounted Svelte component instance.
   */
  (target, keyPath) =>
    mount(FieldPreview, {
      target,
      props: {
        keyPath,
        typedKeyPath: '',
        locale,
        fieldConfig: /** @type {Field} */ (getField({ ...getFieldArgs, keyPath })),
        showLabel: false,
      },
    });

/**
 * Create a widget preview function.
 * @internal
 * @param {(target: HTMLElement, keyPath: FieldKeyPath) => Record<string, any>} mountFieldPreview
 * Function to mount field preview components.
 * @returns {(keyPath: string) => ReactElement} Function that creates widget preview components.
 */
export const createWidgetFor =
  (mountFieldPreview) =>
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
     * @param {HTMLElement} div The div element to mount the Svelte component into.
     */
    const ref = (div) => {
      if (div) {
        component = mountFieldPreview(div, keyPath);
      } else if (component) {
        unmount(component);
      }
    };

    return createElement('div', { ref });
  };

/**
 * Create widgets map for an object value.
 * @internal
 * @param {Record<string, any>} obj Object value.
 * @param {string} basePath Base key path.
 * @param {(keyPath: string) => ReactElement} widgetFor Function to create widget previews.
 * @returns {MapOf<any>} Immutable Map of widgets.
 */
export const createWidgetsMap = (obj, basePath, widgetFor) =>
  ImmutableMap(
    Object.fromEntries(Object.keys(obj).map((key) => [key, widgetFor(`${basePath}.${key}`)])),
  );

/**
 * Create a widgetsFor function.
 * @internal
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
 * Create an asset getter function.
 * @internal
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry object.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name.
 * @returns {(path: string) => ApiAsset | undefined} Function that gets asset URLs.
 */
export const createGetAsset =
  ({ entry, collectionName, fileName }) =>
  /**
   * Get the asset URL for a given asset path.
   * @param {string} path Path to the asset.
   * @returns {ApiAsset | undefined} Asset item.
   */
  (path) => {
    const asset = getAssetByPath({ value: path, entry, collectionName, fileName });

    if (asset) {
      return new AssetProxy(asset);
    }

    return undefined;
  };

/**
 * Get entries from a collection. If `slug` is provided, returns the entry with the matching slug;
 * otherwise, returns all entries.
 * @param {string} name Collection name.
 * @param {string} [slug] Optional entry slug to filter by.
 * @returns {Promise<(MapOf<{ data: RawEntryContent }>[] | MapOf<{ data: RawEntryContent }>)>}
 * Promise resolving to collection entries.
 */
export const getCollectionByName = async (name, slug) => {
  const collection = getCollection(name);

  if (!collection) {
    throw new Error(`Collection "${name}" not found`);
  }

  const { defaultLocale } = collection._i18n;
  const entries = getEntriesByCollection(name);

  /**
   * Convert an entry to an Immutable Map with unflattened content.
   * @param {Entry | undefined} entry Entry object to convert.
   * @returns {MapOf<{ data: RawEntryContent }>} Immutable Map of entry data.
   */
  const convertEntry = (entry) =>
    // Use `ImmutableMap` instead of `fromJS` for shallow conversion
    ImmutableMap({ data: unflatten(entry?.locales[defaultLocale]?.content ?? {}) });

  if (slug) {
    return convertEntry(entries.find((entry) => entry.slug === slug));
  }

  return entries.map(convertEntry);
};

/**
 * Get metadata for fields. For relation fields, looks up and stores the referenced entry content
 * keyed by collection name and value, matching the `fieldsMetaData` structure expected by
 * Netlify/Decap CMS preview templates.
 * @internal
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for getField function.
 * @returns {MapOf<any>} Immutable Map of entry metadata.
 */
export const getMetaData = ({ locale, getFieldArgs }) => {
  const { valueMap = {} } = getFieldArgs;
  /** @type {Record<string, any>} */
  const metaData = {};
  /** @type {Map<string, Entry[]>} */
  const refEntriesCache = new Map();

  Object.entries(valueMap).forEach(([key, value]) => {
    const keyPath = /** @type {FieldKeyPath} */ (key.replace(/\.\d+$/, ''));
    const field = getField({ ...getFieldArgs, keyPath });

    // Populate metadata for relation fields by looking up referenced entries
    if (field?.widget === 'relation') {
      const {
        value_field: valueField = '{{slug}}',
        collection: refCollection,
        file: refFile,
      } = field;

      const refEntries = (() => {
        const cacheKey = `${refCollection}:${refFile ?? ''}`;
        const cache = refEntriesCache.get(cacheKey);

        if (cache) {
          return cache;
        }

        const entries = (
          refFile
            ? [getCollectionFileEntry(refCollection, refFile)]
            : getEntriesByCollection(refCollection)
        ).filter((entry) => !!entry);

        refEntriesCache.set(cacheKey, entries);

        return entries;
      })();

      metaData[keyPath] ??= {};
      metaData[keyPath][refCollection] ??= {};
      metaData[keyPath][refCollection][value] = refEntries.find((entry) =>
        valueField === '{{slug}}'
          ? entry.slug === value
          : entry.locales[locale]?.content?.[valueField] === value,
      )?.locales[locale]?.content;
    }
  });

  return /** @type {MapOf<any>} */ (fromJS(metaData));
};

/**
 * Prepare props for a custom preview template React component. The `document` and `window` props
 * should be provided by the iframe wrapper.
 * @param {object} options Options.
 * @param {EntryDraft} options.draft Entry draft being previewed.
 * @param {InternalLocaleCode} options.locale Current locale.
 * @returns {Omit<CustomPreviewTemplateProps, 'document' | 'window'>} Props for the React component
 * without `document` and `window`.
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
export const preparePreviewTemplateProps = ({ draft, locale }) => {
  const { collectionName, fileName, isIndexFile, originalEntry, currentValues } = draft;

  // Create a synthetic entry object with current values for live preview updates
  const entry = /** @type {Entry} */ ({
    ...originalEntry,
    locales: Object.fromEntries(
      Object.entries(currentValues).map(([_locale, content]) => [
        _locale,
        {
          slug: originalEntry?.locales[_locale]?.slug ?? originalEntry?.slug,
          path: originalEntry?.locales[_locale]?.path ?? originalEntry?.subPath,
          content,
        },
      ]),
    ),
  });

  /* v8 ignore next */
  const valueMap = entry.locales[locale].content ?? {};
  /** @type {RawEntryContent} */
  const rawContent = unflatten(valueMap);
  /** @type {Omit<GetFieldArgs, 'keyPath'>} */
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
  const assetFolder = getAssetFolder({ collectionName, fileName });
  // Create factory functions with bound dependencies
  const mountFieldPreview = createFieldPreviewMounter({ locale, getFieldArgs });
  const widgetFor = createWidgetFor(mountFieldPreview);

  return {
    entry: createEntryMap({
      content: valueMap,
      otherLocales: Object.keys(entry.locales).filter((l) => l !== locale),
      locales: entry.locales,
      /* v8 ignore next */
      slug: entry.slug ?? '',
      /* v8 ignore next */
      path: entry.locales[locale].path ?? '',
      isNew: false,
      collectionName,
      // Collection assets, not entry assets
      associatedAssets: assetFolder
        ? get(allAssets).filter((asset) => isAssetInFolder(asset, assetFolder))
        : [],
    }),
    widgetFor,
    widgetsFor: createWidgetsFor(rawContent, widgetFor),
    getAsset: createGetAsset({ entry, collectionName, fileName }),
    getCollection: getCollectionByName,
    fieldsMetaData: getMetaData({ locale, getFieldArgs }),
    // There are some undocumented props in Netlify/Decap CMS that Sveltia CMS doesn’t implement:
    // boundGetAsset, collection, config, isLoadingAsset, locale, onFieldClick, fields, state
  };
};
