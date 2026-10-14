import { SvelteMap } from 'svelte/reactivity';

/**
 * @import { CustomFileFormat, CustomPage } from '$lib/types/private';
 * @import {
 * AppEventListener,
 * CustomFieldControl,
 * CustomFieldPreview,
 * CustomFieldSchema,
 * CustomFieldSummary,
 * CustomPreviewTemplate,
 * EditorComponentDefinition,
 * StringTransformer,
 * } from '$lib/types/public';
 */

/**
 * Custom components registered using the `CMS.registerEditorComponent` API.
 * @type {Map<string, EditorComponentDefinition>}
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */
export const customComponentRegistry = new Map();

/**
 * Custom pages registered with the `CMS.registerCustomPage` API. Unlike the other registries, it’s
 * reactive, as the global toolbar lists the pages, and a page can be registered after the app has
 * been mounted.
 * @type {SvelteMap<string, CustomPage>}
 * @see https://sveltiacms.app/en/docs/api/custom-pages
 */
export const customPageRegistry = new SvelteMap();

/**
 * Custom field types registered using the `CMS.registerField` API.
 * @type {Map<string, { control: CustomFieldControl | string, preview?: CustomFieldPreview,
 * summary?: CustomFieldSummary, schema?: CustomFieldSchema }>}
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
export const customFieldTypeRegistry = new Map();

/**
 * Custom file formats registered using the `CMS.registerFileFormat` API.
 * @type {Map<string, CustomFileFormat>}
 * @see https://decapcms.org/docs/custom-formatters/
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */
export const customFileFormatRegistry = new Map();

/**
 * Custom entry preview stylesheets registered with the `CMS.registerPreviewStyle` API, each with
 * the collection and file it’s limited to, if any.
 * @type {Set<{ url: string, collection?: string, file?: string }>}
 * @see https://decapcms.org/docs/customization/#registerpreviewstyle
 * @see https://sveltiacms.app/en/docs/api/preview-styles
 */
export const customPreviewStyleRegistry = new Set();

/**
 * Custom entry preview templates registered with the `CMS.registerPreviewTemplate` API.
 * @type {Map<string, CustomPreviewTemplate>}
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
export const customPreviewTemplateRegistry = new Map();

/**
 * Custom string transformations registered with the `CMS.registerStringTransformation` API.
 * @type {Map<string, StringTransformer>}
 * @see https://sveltiacms.app/en/docs/api/string-transformations
 */
export const customStringTransformationRegistry = new Map();

/**
 * Custom event listeners registered with the `CMS.registerEventListener` API.
 * @type {Set<AppEventListener>}
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
 */
export const eventHookRegistry = new Set();
