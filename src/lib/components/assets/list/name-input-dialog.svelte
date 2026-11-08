<!--
  @component
  Dialog asking for the name of a file or folder, shared by the Rename Asset dialog and the dialogs
  naming a subfolder. It shows a description, an optional warning, the input field, an optional
  note and the validation error, while the caller validates the name and acts on it.
-->
<script>
  import { Dialog, TextInput } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} title Dialog title.
   * @property {string} okLabel Label of the OK button.
   * @property {boolean} okDisabled Whether the OK button is disabled.
   * @property {() => void} onOk Called when the OK button is clicked.
   * @property {() => void} [onOpen] Called once the dialog is open.
   * @property {() => void} [onClose] Called once the dialog is closed.
   * @property {string} description Text shown above the input field.
   * @property {string} [warning] Warning shown below the description.
   * @property {string} [blockedMessage] Why the name can’t be submitted, shown in place of the
   * description and the warning. The input field is then disabled.
   * @property {string} value Entered name.
   * @property {HTMLInputElement} [element] Input element.
   * @property {string} ariaLabel The `aria-label` attribute on the input field.
   * @property {() => void} [oninput] Called when the user types in the input field.
   * @property {string} [note] Note shown below the input field, e.g. the name the file will be
   * saved as.
   * @property {string} [error] Validation error, shown below the input field, which is then marked
   * as invalid.
   */

  /** @type {Props} */
  let {
    open = $bindable(false),
    title,
    okLabel,
    okDisabled,
    onOk,
    onOpen = undefined,
    onClose = undefined,
    description,
    warning = undefined,
    blockedMessage = undefined,
    value = $bindable(''),
    element = $bindable(),
    ariaLabel,
    oninput = undefined,
    note = undefined,
    error = undefined,
  } = $props();

  const componentId = $props.id();
</script>

<Dialog {title} bind:open {okLabel} {okDisabled} {onOk} {onOpen} {onClose}>
  {#if blockedMessage}
    <p role="alert">{blockedMessage}</p>
  {:else}
    <p>{description}</p>
    {#if warning}
      <p role="alert" class="warning">{warning}</p>
    {/if}
  {/if}
  <div role="none">
    <TextInput
      dir="auto"
      bind:value
      bind:element
      flex
      disabled={!!blockedMessage}
      {ariaLabel}
      invalid={!!error}
      aria-errormessage="{componentId}-error"
      {oninput}
    />
  </div>
  {#if note}
    <div role="status" class="note">{note}</div>
  {/if}
  <div role="none" class="error" id="{componentId}-error">
    {#if error}
      {error}
    {/if}
  </div>
</Dialog>

<style>
  p {
    margin: 0 0 8px;
  }

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .warning {
    color: var(--sui-warning-foreground-color);
  }

  .note {
    margin: 4px 0 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  .error {
    margin: 0;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
