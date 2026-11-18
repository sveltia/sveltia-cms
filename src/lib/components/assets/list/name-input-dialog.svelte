<!--
  @component
  Dialog asking for the name of a file or folder, shared by the Rename Asset dialog and the dialogs
  naming a subfolder. It shows a description, the input field, an optional note and the validation
  error, while the caller validates the name and acts on it.
-->
<script>
  import { Dialog, TextInput } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} title Dialog title.
   * @property {string} okLabel Label of the OK button.
   * @property {boolean} okDisabled Whether the OK button is disabled.
   * @property {() => void} onOk Called when the OK button is clicked or the name is submitted with
   * the Enter key.
   * @property {() => void} [onOpen] Called once the dialog is open.
   * @property {() => void} [onClose] Called once the dialog is closed.
   * @property {string} description Text shown above the input field.
   * @property {string} [blockedMessage] Why the name can’t be submitted, shown in place of the
   * description. The input field is then disabled.
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
    blockedMessage = undefined,
    value = $bindable(''),
    element = $bindable(),
    ariaLabel,
    oninput = undefined,
    note = undefined,
    error = undefined,
  } = $props();

  const componentId = $props.id();
  /**
   * Whether the user has submitted the name with the Enter key. The dialog has no way to be closed
   * as if its OK button were clicked, so `onOk` is called once it has closed, just before
   * `onClose`, as the button would do.
   */
  let submitted = false;
</script>

<Dialog
  {title}
  bind:open
  {okLabel}
  {okDisabled}
  {onOk}
  onOpen={() => {
    // A submission is only pending while the dialog is closing, so drop one left behind by a close
    // that reopening the dialog has interrupted
    submitted = false;
    onOpen?.();
  }}
  onClose={() => {
    if (submitted) {
      submitted = false;
      onOk();
    }

    onClose?.();
  }}
>
  {#if blockedMessage}
    <p role="alert">{blockedMessage}</p>
  {:else}
    <p>{description}</p>
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
      onkeydown={(/** @type {KeyboardEvent} */ event) => {
        // Submit with the Enter key like the OK button, unless it’s confirming an IME conversion
        if (event.key === 'Enter' && !event.isComposing && !okDisabled) {
          event.preventDefault();
          submitted = true;
          open = false;
        }
      }}
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
