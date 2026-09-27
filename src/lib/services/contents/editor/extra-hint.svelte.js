import { getContext } from 'svelte';

/**
 * @import { Component } from 'svelte';
 * @import { FieldEditorContext } from '$lib/types/private';
 */

/**
 * Show the given component as an extra hint below the field, e.g. a character counter, if the
 * editor is rendered in a field editor that provides a place for it. Call it while initializing a
 * field’s editor component, as it reads the `field-editor` context and creates an effect.
 * @param {Component<any>} component Component to render.
 */
export const setExtraHint = (component) => {
  /** @type {FieldEditorContext} */
  const { extraHint } = getContext('field-editor') ?? {};

  $effect(() => {
    if (extraHint) {
      extraHint.current = component;
    }
  });
};
