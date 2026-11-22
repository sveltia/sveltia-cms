<!--
  @component
  The text area to write a comment on an entry, with where it goes. Posting doesn’t need the entry
  to be saved.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, TextArea } from '@sveltia/ui';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import { conversations, sendComment } from '$lib/services/additions/conversation.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';

  /**
   * @typedef {object} Props
   * @property {string} entryKey Key of the entry.
   */

  /** @type {Props} */
  let { entryKey } = $props();

  const id = $props.id();

  const runner = new TaskRunner({ fallbackMessageKey: 'additions.conversation.send_failed' });

  const body = $derived(conversations.drafts[entryKey] ?? '');

  /**
   * Send the comment.
   */
  const send = async () => {
    if (!body.trim() || runner.busy) {
      return;
    }

    await runner.run(() => sendComment(entryKey));
  };
</script>

<div role="none" class="composer">
  <TextArea
    bind:value={
      () => body,
      (value) => {
        conversations.drafts[entryKey] = value;
      }
    }
    aria-label={_('additions.conversation.comment_label')}
    aria-describedby="{id}-hint"
    placeholder={_('additions.conversation.placeholder')}
    flex
    autoResize
    onkeydown={(/** @type {KeyboardEvent} */ event) => {
      // Ctrl+Enter, or Command+Enter on Apple platforms, sends the comment
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        send();
      }
    }}
  />
  <ErrorMessage message={runner.error} />
  <div role="none" class="footer">
    <span id="{id}-hint" class="hint">{_('additions.conversation.visible_to_cms_users')}</span>
    <Button
      variant="primary"
      size="small"
      label={_('additions.conversation.send')}
      disabled={!body.trim() || runner.busy}
      onclick={send}
    />
  </div>
</div>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--sui-secondary-border-color);
    padding: 12px 16px;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hint {
    flex: auto;
    color: var(--sui-tertiary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
