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
 * Custom components registered using `CMS.registerEditorComponent`.
 * @type {Map<string, EditorComponentDefinition>}
 */
export const customComponentRegistry = new Map();

/**
 * @type {Map<string, CustomFileFormat>}
 */
export const customFileFormatRegistry = new Map();

/**
 * Custom entry preview stylesheet URLs registered with the `CMS.registerPreviewStyle()` API.
 * @type {Set<string>}
 * @see https://decapcms.org/docs/customization/
 * @see https://sveltiacms.app/en/docs/api/preview-styles
 */
export const customPreviewStyleRegistry = new Set();

/**
 * Custom entry preview templates registered with the `CMS.registerPreviewTemplate()` API.
 * @type {Map<string, ComponentType<CustomPreviewTemplateProps>>}
 * @see https://decapcms.org/docs/customization/#registerpreviewtemplate
 * @see https://sveltiacms.app/en/docs/api/preview-templates
 */
export const customPreviewTemplateRegistry = new Map();

/**
 * @type {Set<AppEventListener>}
 */
export const eventHookRegistry = new Set();
