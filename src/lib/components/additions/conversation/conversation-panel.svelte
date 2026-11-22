<!--
  @component
  An entry’s conversation: comments kept by Sveltia CMS Additions, private to the CMS’s users.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import ConversationComposer from '$lib/components/additions/conversation/conversation-composer.svelte';
  import ConversationItem from '$lib/components/additions/conversation/conversation-item.svelte';
  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { additionsComments } from '$lib/services/additions/comments.svelte';
  import { getConversationAliasKeys } from '$lib/services/additions/conversation-aliases';
  import {
    conversations,
    loadConversation,
    loadOlderComments,
  } from '$lib/services/additions/conversation.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getDraftEntryKey } from '$lib/services/contents/entry/entry-key';

  const entryDraft = getEntryDraftContext();

  const entryKey = $derived(getDraftEntryKey(entryDraft.current));
  // Keys the comments are still kept under from before the entry was renamed outside the CMS, as
  // one string, so the comments aren’t loaded again whenever any count changes
  const aliasKeysId = $derived(getConversationAliasKeys(entryDraft.current).join('\n'));
  const aliasKeys = $derived(aliasKeysId ? aliasKeysId.split('\n') : []);
  const state = $derived(entryKey ? conversations.entries[entryKey] : undefined);
  // Changes another tab or user made, announced over the socket
  const version = $derived(
    [entryKey, ...aliasKeys].reduce(
      (total, key) => total + (key ? (additionsComments.versions[key] ?? 0) : 0),
      0,
    ),
  );

  /** Runs the loading of older comments, showing why it failed. */
  const olderRunner = new TaskRunner();

  /**
   * Load the comments again.
   */
  const reload = () => {
    if (entryKey) {
      loadConversation(entryKey, aliasKeys);
    }
  };

  $effect(() => {
    void entryKey;
    void aliasKeysId;
    void version;
    untrack(reload);
  });
</script>

<PanelContainer title={_('additions.conversation.title')}>
  {#snippet actions()}
    <Button
      variant="ghost"
      iconic
      aria-label={_('additions.conversation.refresh')}
      disabled={!entryKey || state?.loading}
      onclick={reload}
    >
      <Icon name="refresh" />
    </Button>
  {/snippet}
  <div role="none" class="wrapper">
    <div
      role="log"
      class="timeline"
      aria-label={_('additions.conversation.timeline')}
      aria-busy={state?.loading}
    >
      {#if state?.error}
        <div role="alert" class="error">{state.error}</div>
      {/if}
      {#if !state?.loaded}
        <div class="empty">{_('loading')}</div>
      {:else if !state.comments.length}
        <div class="empty">{_('additions.conversation.empty')}</div>
      {/if}
      {#if entryKey && state?.hasMore}
        <!-- A long conversation is loaded from its latest comments -->
        <Button
          variant="tertiary"
          label={_('additions.conversation.show_older')}
          disabled={olderRunner.busy}
          onclick={() => olderRunner.run(() => loadOlderComments(entryKey))}
        />
        {#if olderRunner.error}
          <div role="alert" class="error">{olderRunner.error}</div>
        {/if}
      {/if}
      {#if entryKey}
        {#each state?.comments ?? [] as item (item.id)}
          <ConversationItem {item} {entryKey} />
        {/each}
      {/if}
    </div>
    {#if entryKey}
      <ConversationComposer {entryKey} />
    {/if}
  </div>
</PanelContainer>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .timeline {
    flex: auto;
    overflow: auto;
    padding: 8px 16px;
  }

  .empty {
    padding: 8px 0;
    color: var(--sui-secondary-foreground-color);
  }

  .error {
    padding: 8px 0;
    color: var(--sui-error-foreground-color);
  }
</style>
