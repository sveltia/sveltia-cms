<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { backend } from '$lib/services/backends';
  import { getCommitMessagePromptMode } from '$lib/services/backends/commit-prompt';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { fetchEntryHistory } from '$lib/services/contents/entry/history';
  import { formatDate } from '$lib/services/utils/date';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { Entry, FileCommit } from '$lib/types/private';
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FileCommit[]} */
  let commits = $state([]);
  let loading = $state(false);
  let error = $state(false);

  /**
   * Whether to show the commit messages. Without the commit message prompt, the CMS’s own commit
   * messages for an entry are all the same generated text, so they add nothing.
   */
  const showMessages = $derived(!!getCommitMessagePromptMode());

  /**
   * The entry whose history is shown. Saving without closing the editor replaces the draft with one
   * for the saved entry while the panel stays mounted, so the history is reloaded then.
   */
  const entry = $derived(entryDraft.current?.originalEntry);

  /**
   * Load the commit history for the given entry, using the external cache. A result that arrives
   * after the entry has been replaced again is discarded.
   * @param {Entry} target Entry.
   */
  const load = async (target) => {
    loading = true;

    const result = await fetchEntryHistory(target);

    if (target === entry) {
      ({ commits, error } = result);
      loading = false;
    }
  };

  $effect(() => {
    /* v8 ignore next 3 -- the panel is only offered for an existing entry */
    if (!entry) {
      return;
    }

    const target = entry;

    // Don’t let anything the fetch reads become a dependency of the effect
    untrack(() => load(target));
  });
</script>

<PanelContainer title={_('entry_sidebar.history.title')}>
  {#if loading}
    <div class="empty">{_('loading')}</div>
  {:else if error}
    <div class="empty">{_('entry_sidebar.history.fetch_failed')}</div>
  {:else if commits.length > 0}
    <div role="list" class="commits">
      {#each commits as commit (commit.sha)}
        {@const commitURL = backend.current?.repository?.commitBaseURL
          ? `${backend.current.repository.commitBaseURL}/${commit.sha}`
          : undefined}
        {@const message = showMessages ? commit.message : ''}
        <div role="listitem">
          <Button
            class="ref"
            variant="ghost"
            role="link"
            disabled={!commitURL}
            onclick={() => {
              // The button is disabled without a URL
              openNewTab(/** @type {string} */ (commitURL));
            }}
          >
            {#if commit.authorAvatarURL}
              <img
                class="avatar"
                src={commit.authorAvatarURL}
                alt=""
                width="24"
                height="24"
                loading="lazy"
              />
            {:else}
              <span class="avatar placeholder" aria-hidden="true"></span>
            {/if}
            <span class="details">
              {#if message}
                <span class="message" title={message}><bdi>{message}</bdi></span>
              {/if}
              <span class="meta" class:secondary={!!message}>
                <span class="author"><bdi>{commit.authorName}</bdi></span>
                <span class="date">{formatDate(commit.date, appLocale.current)}</span>
              </span>
            </span>
          </Button>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">{_('entry_sidebar.history.no_history')}</div>
  {/if}
</PanelContainer>

<style>
  .commits {
    padding: 4px;
  }

  .avatar {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--sui-secondary-background-color);
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    font-size: var(--sui-font-size-small);
  }

  .message,
  .author {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;

    &.secondary {
      flex-direction: row;
      gap: 8px;
      color: var(--sui-tertiary-foreground-color);
      font-size: var(--sui-font-size-x-small);
    }
  }

  .date {
    flex: none;
    color: var(--sui-tertiary-foreground-color);
  }
</style>
