<!--
  @component
  A comment in an entry’s conversation, with Edit and Delete for the user’s own.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, Menu, MenuButton, MenuItem, TextArea } from '@sveltia/ui';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import Avatar from '$lib/components/common/avatar.svelte';
  import { renderCommentBody } from '$lib/services/additions/comment-body';
  import { removeComment, updateComment } from '$lib/services/additions/conversation.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { formatRecentDateTime } from '$lib/services/utils/date';

  /**
   * @import { ConversationItem } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ConversationItem} item Comment.
   * @property {string} entryKey Key of the entry it’s on.
   */

  /** @type {Props} */
  let { item, entryKey } = $props();

  const id = $props.id();
  const runner = new TaskRunner();
  const { run } = runner;

  let editing = $state(false);
  let editedBody = $state('');
  let confirmingDelete = $state(false);

  const authorName = $derived.by(() => {
    if (!item.author) {
      return _('additions.conversation.deleted_user');
    }

    return item.author.isSelf ? _('additions.conversation.you') : item.author.name;
  });

  // An edit made within a few seconds of writing isn’t worth mentioning
  const edited = $derived(item.updatedDate.getTime() - item.createdDate.getTime() > 5000);
</script>

<article aria-labelledby="{id}-header">
  <header id="{id}-header">
    <!-- Like a commit in the History panel: the author’s initials, as there’s no avatar, and none
    for a deleted user, whose label isn’t a name -->
    <Avatar name={item.author?.name} username={item.author?.login} />
    <!-- The name and the date on lines of their own, as both can be long in a narrow panel -->
    <div role="none" class="byline">
      <span class="author">{authorName}</span>
      <span class="meta">
        {formatRecentDateTime({ timestamp: item.createdDate, locale: appLocale.current })}
        {#if edited}
          · {_('additions.conversation.edited')}
        {/if}
      </span>
    </div>
    <!-- The author can always delete their comment, so whoever can edit one can delete it -->
    {#if item.canDelete}
      <MenuButton
        variant="ghost"
        iconic
        size="small"
        popupPosition="bottom-right"
        aria-label={_('additions.conversation.options')}
      >
        {#snippet popup()}
          <Menu ariaLabel={_('additions.conversation.options')}>
            {#if item.canEdit}
              <MenuItem
                label={_('additions.conversation.edit')}
                onclick={() => {
                  editedBody = item.body;
                  editing = true;
                }}
              />
            {/if}
            <MenuItem
              label={_('additions.conversation.delete')}
              onclick={() => {
                confirmingDelete = true;
              }}
            />
          </Menu>
        {/snippet}
      </MenuButton>
    {/if}
  </header>
  {#if editing}
    <div role="none" class="edit">
      <TextArea
        bind:value={editedBody}
        aria-label={_('additions.conversation.comment_label')}
        flex
        autoResize
      />
      <div role="none" class="buttons">
        <Button
          variant="primary"
          size="small"
          label={_('additions.conversation.save')}
          disabled={!editedBody.trim() || runner.busy}
          onclick={() =>
            run(async () => {
              await updateComment(entryKey, item.id, editedBody);
              editing = false;
            })}
        />
        <Button
          variant="secondary"
          size="small"
          label={_('cancel')}
          onclick={() => {
            editing = false;
            runner.error = '';
          }}
        />
      </div>
    </div>
  {:else}
    <div role="none" class="body">
      {@html renderCommentBody(item.body)}
    </div>
  {/if}
  <ErrorMessage message={runner.error} />
</article>

<ConfirmationDialog
  bind:open={confirmingDelete}
  title={_('additions.conversation.delete')}
  okLabel={_('additions.conversation.delete')}
  onOk={() => run(() => removeComment(entryKey, item.id))}
>
  {_('additions.conversation.delete_confirmation')}
</ConfirmationDialog>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* The name and date look like those of a commit in the History panel */
  .byline {
    display: flex;
    flex: auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    font-size: var(--sui-font-size-small);
    overflow-wrap: anywhere;
  }

  .meta {
    color: var(--sui-tertiary-foreground-color);
  }

  /* A tinted box, set apart from the header above it */
  .body {
    border-radius: var(--sui-control-medium-border-radius);
    padding: 8px 12px;
    background-color: var(--sui-secondary-background-color);
    overflow-wrap: anywhere;

    :global {
      p,
      ul,
      ol,
      pre,
      blockquote {
        margin: 0 0 8px;
      }

      :last-child {
        margin-bottom: 0;
      }

      img {
        max-width: 100%;
      }

      pre {
        overflow: auto;
      }
    }
  }

  .edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .buttons {
    display: flex;
    gap: 8px;
  }
</style>
