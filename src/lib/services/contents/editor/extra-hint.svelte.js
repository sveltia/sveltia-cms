import { getFieldEditorContext } from '$lib/services/contents/editor/field-context';

/**
 * @import { Component } from 'svelte';
 */

/**
 * Show the given component as an extra hint below the field, e.g. a character counter, if the
 * editor is rendered in a field editor that provides a place for it. Call it while initializing a
 * field’s editor component, as it reads the `field-editor` context and creates an effect.
 * @param {Component<any>} component Component to render.
 */
export const setExtraHint = (component) => {
  const { extraHint } = getFieldEditorContext();

  $effect(() => {
    if (extraHint) {
      extraHint.current = component;
    }
  });
};
