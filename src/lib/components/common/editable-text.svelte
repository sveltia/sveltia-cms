<!--
  @component
  Show a text value as read-only, with a pencil button to edit it inline. While it’s being edited,
  the value is in a text field with the Done and Cancel buttons: Enter applies the change, and
  Escape cancels it without closing the entry editor.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import { tick, untrack } from 'svelte';

  import { activeInlineEditors } from '$lib/services/contents/editor';

  /**
   * @typedef {object} Props
   * @property {string} id ID of the value, which the buttons control.
   * @property {string} value Value to show.
   * @property {string} [initialText] Text to start editing with. Default: the value.
   * @property {boolean} [editing] Whether the value is being edited.
   * @property {string} [text] Text being edited.
   * @property {HTMLInputElement} [inputElement] Text field shown while editing.
   * @property {boolean} [canEdit] Whether the value can be edited, which shows the pencil button.
   * @property {string} [editLabel] Accessible label of the pencil button. Required when the value
   * can be edited.
   * @property {string} [placeholder] Placeholder of the text field.
   * @property {boolean} [readonly] Whether the field is read-only.
   * @property {boolean} [invalid] Whether the value is invalid.
   * @property {boolean} [required] Whether the value is required.
   * @property {boolean} [applyDisabled] Whether to disable the Done button. The Enter key still
   * calls `onApply`, which decides what to do with the text.
   * @property {'ltr' | 'rtl' | 'auto'} [dir] Text direction of the value.
   * @property {string} [ariaLabelledby] ID of the element labelling the value.
   * @property {string} [ariaErrormessage] ID of the element describing an error.
   * @property {(text: string) => number | undefined} [getSelectionEnd] Where the initial
   * selection ends in the text field, e.g. before a file extension. The whole text is selected by
   * default.
   * @property {(text: string) => boolean | void} [onApply] Called with the edited text. Editing
   * ends unless it returns `false`, e.g. when a confirmation is needed first. Required when the
   * value can be edited.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    value,
    initialText = undefined,
    // No fallback values, so they can be bound to properties that are yet to be set, e.g. in a
    // list of values
    editing = $bindable(),
    text = $bindable(),
    inputElement = $bindable(),
    canEdit = true,
    editLabel = undefined,
    placeholder = undefined,
    readonly = true,
    invalid = false,
    required = false,
    applyDisabled = false,
    dir = 'auto',
    ariaLabelledby = undefined,
    ariaErrormessage = undefined,
    getSelectionEnd = undefined,
    onApply = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Start editing the value. The text field is focused, with the text selected.
   */
  const startEditing = async () => {
    const initial = initialText ?? value;

    text = initial;
    editing = true;
    await tick();
    inputElement?.focus();
    inputElement?.setSelectionRange(0, getSelectionEnd?.(initial) ?? initial.length);
  };

  /**
   * Apply the edited text.
   */
  const apply = () => {
    // The text is set as soon as the editing starts
    // `onApply` is given whenever the value can be edited
    const handler = /** @type {(text: string) => boolean | void} */ (onApply);

    if (handler(/** @type {string} */ (text)) !== false) {
      editing = false;
    }
  };

  $effect(() => {
    if (!editing) {
      return undefined;
    }

    // Let the Escape key cancel the editing instead of closing the entry editor. The count is read
    // to be updated, which must not make it a dependency, or the effect would loop
    untrack(() => {
      activeInlineEditors.current += 1;
    });

    return () => {
      activeInlineEditors.current -= 1;
    };
  });
</script>

<div role="none" class="editable-text">
  {#if editing}
    <TextInput
      {id}
      dir="auto"
      flex
      bind:value={text}
      bind:element={inputElement}
      {placeholder}
      {invalid}
      {required}
      aria-labelledby={ariaLabelledby}
      aria-errormessage={ariaErrormessage}
      onkeydown={(/** @type {KeyboardEvent} */ event) => {
        const { key, isComposing } = event;

        // Ignore the Enter key while the user is typing with an IME
        if (isComposing || !(key === 'Enter' || key === 'Escape')) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (key === 'Escape') {
          editing = false;
        } else {
          apply();
        }
      }}
    />
    <Button
      size="small"
      iconic
      disabled={applyDisabled}
      aria-label={_('done')}
      aria-controls={id}
      onclick={() => {
        apply();
      }}
    >
      {#snippet startIcon()}
        <Icon name="check" />
      {/snippet}
    </Button>
    <Button
      size="small"
      iconic
      aria-label={_('cancel')}
      aria-controls={id}
      onclick={() => {
        editing = false;
      }}
    >
      {#snippet startIcon()}
        <Icon name="close" />
      {/snippet}
    </Button>
  {:else}
    <div
      role="textbox"
      {id}
      tabindex="0"
      class="value"
      {dir}
      aria-readonly={readonly}
      aria-invalid={invalid}
      aria-required={required}
      aria-labelledby={ariaLabelledby}
      aria-errormessage={ariaErrormessage}
    >
      {value}
    </div>
    {#if canEdit}
      <Button
        size="small"
        iconic
        aria-label={editLabel}
        aria-controls={id}
        onclick={() => {
          startEditing();
        }}
      >
        {#snippet startIcon()}
          <Icon name="edit" />
        {/snippet}
      </Button>
    {/if}
  {/if}
</div>

<style>
  .editable-text {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .value {
    flex: auto;
    margin: var(--sui-focus-ring-width);
    padding: 4px;
    word-break: break-all;

    &:empty {
      margin: 0;
      padding: 0;
    }
  }
</style>
