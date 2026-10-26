<script>
  import { onMount } from 'svelte';

  import {
    getInlinePreview,
    renderInlinePreview,
  } from '$lib/services/contents/fields/rich-text/components/inline-preview';
  import { observeReadonly } from '$lib/services/contents/fields/rich-text/components/utils';

  /**
   * @import { ResolvedEditorComponentDefinition } from '$lib/types/private';
   * @import { InlineEditorComponentDefinition } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} componentName Rich text editor component name.
   * @property {string} label Component label.
   * @property {ResolvedEditorComponentDefinition['toPreview']} [toPreview] Function to convert the
   * component data to its preview.
   * @property {ResolvedEditorComponentDefinition['toBlock']} toInline Function to convert the
   * component data to Markdown.
   * @property {InlineEditorComponentDefinition['onEdit']} [onEdit] Function called when the
   * component is clicked, returning its new data.
   * @property {Record<string, any> | undefined} values Initial component data.
   * @property {(event: CustomEvent) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    componentName,
    label,
    toPreview,
    toInline,
    onEdit,
    values,
    onChange = () => undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /**
   * Current component data. Initialized from the `values` prop once, then replaced with the result
   * of `onEdit`, or with {@link setValues} by the node.
   * @type {Record<string, any>}
   */
  // svelte-ignore state_referenced_locally
  let data = $state.raw(values ?? {});
  /**
   * Whether the rich text field this component is in can’t be edited, e.g. with the `readonly`
   * option or in a locale that follows the default one. It’s looked up through the DOM.
   */
  let readonly = $state(false);
  /**
   * Whether the `onEdit` function is in progress, so another click doesn’t call it again.
   */
  let editing = false;
  /**
   * Observer following the read-only state of the rich text field this component is in.
   * @type {MutationObserver | undefined}
   */
  let readonlyObserver = undefined;

  /**
   * Preview of the component shown within the text.
   */
  const preview = $derived(getInlinePreview({ toPreview, toInline }, data));

  /**
   * Get the wrapper element.
   * @returns {HTMLElement | undefined} Wrapper.
   */
  export const getElement = () => wrapper;

  /**
   * Replace the component data, e.g. once an asynchronous `onInsert` function has resolved.
   * @param {Record<string, any>} newValues New data.
   */
  export const setValues = (newValues) => {
    data = newValues;
  };

  /**
   * Call the developer’s `onEdit` function, and update the component with the data it returns, if
   * any. An error thrown by the function is logged, leaving the component unchanged.
   */
  const edit = async () => {
    if (!onEdit || readonly || editing) {
      return;
    }

    editing = true;

    try {
      const result = await onEdit({ data });

      if (result && typeof result === 'object') {
        data = result;
        onChange(new CustomEvent('update', { detail: result }));
      }
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      editing = false;
    }
  };

  onMount(() => {
    window.requestAnimationFrame(() => {
      readonlyObserver = observeReadonly(wrapper, (value) => {
        readonly = value;
      });
    });

    return () => {
      readonlyObserver?.disconnect();
    };
  });
</script>

<!-- The preview of the component, right within the text. It opens the developer’s own UI on click
unless there is no `onEdit` function; it can still be focused then, to be removed with the Backspace
or Delete key. The preview, e.g. a linked page name, is what assistive technology reads: a button
takes its name from it and the label as its description, while a group keeps it readable -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
  bind:this={wrapper}
  role={onEdit ? 'button' : 'group'}
  class="component inline-pattern"
  class:editable={!!onEdit && !readonly}
  contenteditable="false"
  tabindex="0"
  aria-label={onEdit ? undefined : label}
  title={label}
  data-component-name={componentName}
  onclick={(event) => {
    // Keep a link in the preview, e.g. a wikilink, from navigating away from the editor
    event.preventDefault();
    edit();
  }}
  onkeydown={(event) => {
    // Activate the button with the Enter or Space key, like a native one. The Space key would
    // otherwise reach the rich text editor
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      edit();
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();

      if (!readonly) {
        onChange(new CustomEvent('remove'));
      }
    }
  }}
>
  <span role="none" class="preview" {@attach (element) => renderInlinePreview(element, preview)}
  ></span>
</span>

<style>
  .inline-pattern {
    display: inline-flex;
    align-items: baseline;
    vertical-align: baseline;
    border-radius: var(--sui-control-medium-border-radius);
    padding-inline: 2px;
    cursor: default;
    -webkit-user-select: none;
    user-select: none;

    &.editable {
      cursor: pointer;

      &:hover {
        background-color: var(--sui-hover-background-color);
      }
    }

    &:focus {
      outline: 2px solid var(--sui-primary-accent-color-translucent);
      outline-offset: 1px;
    }
  }
</style>
