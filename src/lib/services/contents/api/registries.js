/**
 * @import { ComponentType } from 'react';
 * @import { CustomFileFormat } from '$lib/types/private';
 * @import {
 * AppEventListener,
 * CustomPreviewTemplateProps,
 * EditorComponentDefinition,
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
 * Custom file formats registered using the `CMS.registerFileFormat` API.
 * @type {Map<string, CustomFileFormat>}
 * @see https://decapcms.org/docs/custom-formatters/
 * @see https://sveltiacms.app/en/docs/api/file-formats
 */
export const customFileFormatRegistry = new Map();

/**
 * Custom entry preview stylesheet URLs registered with the `CMS.registerPreviewStyle` API.
 * @type {Set<string>}
 * @see https://decapcms.org/docs/customization/#registerpreviewstyle
 * @see https://sveltiacms.app/en/docs/api/preview-styles
 */
export const customPreviewStyleRegistry = new Set();

/**
 * Custom entry preview templates registered with the `CMS.registerPreviewTemplate` API.
 * @type {Map<string, ComponentType<CustomPreviewTemplateProps>>}
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
export const customPreviewTemplateRegistry = new Map();

/**
 * Custom event listeners registered with the `CMS.registerEventListener` API.
 * @type {Set<AppEventListener>}
 * @see https://decapcms.org/docs/registering-events/
 * @see https://sveltiacms.app/en/docs/api/events
 */
export const eventHookRegistry = new Set();
