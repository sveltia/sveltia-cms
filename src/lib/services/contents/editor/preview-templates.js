import { createElement, useLayoutEffect, useRef } from 'react';
import { mount, unmount } from 'svelte';

import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
import { getImmutable } from '$lib/services/api/immutable';
import {
  buildPreviewData,
  convertEntryToMap,
  getAssociatedPreviewAssets,
} from '$lib/services/api/preview-data';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { createEntryDraftMountContext } from '$lib/services/contents/draft/state.svelte';
import { getField } from '$lib/services/contents/entry/fields';
import { unflattenMap } from '$lib/services/utils/object';

/**
 * @import { MapOf } from 'immutable';
 * @import { ReactElement, RefObject } from 'react';
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
 * Mount a Svelte component for field preview.
 * @param {object} args Arguments.
 * @param {HTMLElement} args.target The DOM element to mount the Svelte component into.
 * @param {EntryDraftState} args.entryDraft Entry draft state of the editor. The mounted component
 * is outside the Svelte component tree, so the state has to be passed to it as a mount context.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {FieldKeyPath} args.keyPath The key path of the field to preview.
 * @param {Field} args.fieldConfig Configuration of the field.
 * @returns {Record<string, any>} The mounted Svelte component instance.
 */
export const mountFieldPreview = ({ target, entryDraft, locale, keyPath, fieldConfig }) =>
  mount(FieldPreview, {
    target,
    context: createEntryDraftMountContext(entryDraft),
    props: { keyPath, typedKeyPath: '', locale, fieldConfig, showLabel: false },
  });

/**
 * React component rendering the preview of a field, which `widgetFor()` returns. It’s defined once,
 * so that React keeps the preview mounted when the template renders again, as it does on every
 * change to the entry. The preview follows the draft by itself, so it’s only mounted again when it
 * has to show another field or locale: remounting it on every keystroke would make an image flash,
 * a map reinitialize and the preview lose its state.
 * @param {object} props Props.
 * @param {EntryDraftState} props.entryDraft Entry draft state of the editor.
 * @param {InternalLocaleCode} props.locale Current locale.
 * @param {FieldKeyPath} props.keyPath The key path of the field to preview.
 * @param {Field} props.fieldConfig Configuration of the field.
 * @returns {ReactElement} A div the field preview is mounted into.
 */
export const FieldWidget = ({ entryDraft, locale, keyPath, fieldConfig }) => {
  /** @type {RefObject<HTMLDivElement | null>} */
  const ref = useRef(null);

  useLayoutEffect(() => {
    const component = mountFieldPreview({
      target: /** @type {HTMLDivElement} */ (ref.current),
      entryDraft,
      locale,
      keyPath,
      fieldConfig,
    });

    return () => {
      unmount(component);
    };
  }, [entryDraft, locale, keyPath, fieldConfig]);

  return createElement('div', { ref });
};

/**
 * Create a widget preview function for React preview templates.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Entry draft state of the editor, used by the field
 * previews.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for getField function.
 * @returns {(keyPath: string) => ReactElement | null} Function that creates widget previews.
 */
export const createWidgetFor =
  ({ entryDraft, locale, getFieldArgs }) =>
  /**
   * Get a widget preview component for a field.
   * @param {string} keyPath Field key path.
   * @returns {ReactElement | null} Widget preview. It’s a React element that renders a Svelte
   * component inside a div, or `null` if the key path doesn’t point to a configured field, like
   * Netlify/Decap CMS returns.
   */
  (keyPath) => {
    const fieldConfig = getField({ ...getFieldArgs, keyPath });

    if (!fieldConfig) {
      return null;
    }

    return createElement(FieldWidget, { entryDraft, locale, keyPath, fieldConfig });
  };

/**
 * Create widgets map for an object value. Only the keys pointing to a configured subfield are
 * included.
 * @param {Record<string, any>} obj Object value.
 * @param {string} basePath Base key path.
 * @param {(keyPath: string) => ReactElement | null} widgetFor Function to create widget previews.
 * @returns {MapOf<any>} Immutable Map of widgets.
 */
export const createWidgetsMap = (obj, basePath, widgetFor) =>
  getImmutable().Map(
    Object.fromEntries(
      Object.keys(obj)
        .map((key) => [key, widgetFor(`${basePath}.${key}`)])
        .filter(([, widget]) => widget !== null),
    ),
  );

/**
 * Create a widgetsFor function.
 * @param {RawEntryContent} content Unflattened entry content.
 * @param {(keyPath: string) => ReactElement | null} widgetFor Function to create widget
 * previews.
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

  const widgetFor = createWidgetFor({ entryDraft, locale, getFieldArgs });

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
