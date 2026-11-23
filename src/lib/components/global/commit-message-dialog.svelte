<!--
  @component
  Prompt dialog asking the user for a commit message when the `prompt_commit_messages` backend
  option is set. The save waits here until the user answers or cancels.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { PromptDialog, TextInput } from '@sveltia/ui';

  import { commitMessageRequest } from '$lib/services/backends/commit-prompt';

  /**
   * @import { CommitMessageRequest } from '$lib/types/private';
   */

  const id = $props.id();
  const request = $derived(commitMessageRequest.current);
  // Writable, because the dialog sets it back to `false` when it’s dismissed
  let open = $derived(!!request);
  /**
   * Whether the user has submitted the text with the Enter key. The answer is only sent once the
   * dialog has closed, so the content can still read the request during the closing transition.
   */
  let submitted = false;

  // These are only read while the dialog is open, for a request
  const { mode, defaultMessage } = $derived(/** @type {CommitMessageRequest} */ (request));
  // Writable, because the user edits it. It starts over with each new request, even if the initial
  // value is the same as the last one’s
  let value = $derived(/** @type {CommitMessageRequest} */ (request).initialValue);

  /**
   * Message as it will be recorded, shown with the `prefix` and `suffix` modes.
   */
  const preview = $derived.by(() => {
    const text = value.trim();

    if (!text) {
      return defaultMessage;
    }

    return mode === 'prefix' ? `${text} ${defaultMessage}` : `${defaultMessage} ${text}`;
  });
</script>

<PromptDialog
  bind:open
  title={_('commit_message.title')}
  onOk={() => {
    request?.respond(value);
  }}
  onClose={() => {
    // Covers the Cancel button, the Escape key and any other way out of the dialog, as well as the
    // Enter key. Clicking OK has already settled the request, so this leaves it alone
    request?.respond(submitted ? value : null);
    submitted = false;
  }}
>
  {_(mode === true ? 'commit_message.description_replace' : 'commit_message.description_addition')}
  {#snippet input()}
    <TextInput
      dir="auto"
      bind:value
      flex
      autofocus
      ariaLabel={_(mode === true ? 'commit_message.message' : 'commit_message.addition')}
      aria-describedby={mode === true ? undefined : `${id}-preview`}
      onkeydown={(/** @type {KeyboardEvent} */ event) => {
        // Submit with the Enter key, unless it’s confirming an IME conversion
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          submitted = true;
          open = false;
        }
      }}
    />
    {#if mode !== true}
      <div role="none" id="{id}-preview" class="preview">
        {_('commit_message.preview', { values: { message: preview } })}
      </div>
    {/if}
  {/snippet}
</PromptDialog>

<style lang="scss">
  .preview {
    margin: 8px 0 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
    overflow-wrap: anywhere;
  }
</style>
