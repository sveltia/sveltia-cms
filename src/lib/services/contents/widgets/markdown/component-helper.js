import { editors } from '$lib/components/contents/details/widgets';
import { MULTI_VALUE_WIDGETS, SIMPLE_VALUE_WIDGETS } from '$lib/services/contents/widgets';

/**
 * @import { Component } from 'svelte';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Check if the widget is supported by the editor. We only support a subset of widgets at this time.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} `true` if the widget is supported, `false` otherwise.
 */
export const isWidgetSupported = (fieldConfig) => {
  const { widget = 'string', multiple = false } = fieldConfig;

  if (!(widget in editors)) {
    return false;
  }

  if (SIMPLE_VALUE_WIDGETS.includes(widget)) {
    return true;
  }

  if (MULTI_VALUE_WIDGETS.includes(widget) && !multiple) {
    return true;
  }

  if (widget === 'code' && fieldConfig.output_code_only) {
    return true;
  }

  return false;
};

/**
 * Get the editor component for the given field configuration.
 * @param {Field} fieldConfig Field configuration.
 * @returns {Component | null} The Svelte component for the widget, or `null` if not supported.
 */
export const getEditorComponent = (fieldConfig) => {
  const { widget = 'string' } = fieldConfig;

  if (isWidgetSupported(fieldConfig)) {
    return editors[widget];
  }

  return null;
};
