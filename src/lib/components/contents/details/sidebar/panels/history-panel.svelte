<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { backend } from '$lib/services/backends';
  import { entryDraft } from '$lib/services/contents/draft';
  import { fetchEntryHistory } from '$lib/services/contents/entry/history';
  import { formatDate } from '$lib/services/utils/date';

  /**
   * @import { FileCommit } from '$lib/types/private';
   */

  /** @type {FileCommit[]} */
  let commits = $state([]);
  let loading = $state(false);
  let error = $state(false);

  /**
   * Load the commit history for the current entry, using the external cache.
   */
  const load = async () => {
    const entry = $entryDraft?.originalEntry;

    if (!entry) {
      return;
    }

    loading = true;
    ({ commits, error } = await fetchEntryHistory(entry));
    loading = false;
  };

  onMount(() => {
    load();
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
        {@const commitURL = $backend?.repository?.commitBaseURL
          ? `${$backend.repository.commitBaseURL}/${commit.sha}`
          : undefined}
        <Button
          class="ref"
          variant="ghost"
          role="link"
          disabled={!commitURL}
          onclick={() => {
            if (commitURL) {
              window.open(commitURL, '_blank', 'noopener,noreferrer');
            }
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
            <span class="author">{commit.authorName}</span>
            <span class="date">{formatDate(commit.date, appLocale.current)}</span>
          </span>
        </Button>
      {/each}
    </div>
  {:else}
    <div class="empty">{_('entry_sidebar.history.no_history')}</div>
  {/if}
</PanelContainer>

<style lang="scss">
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

  .author {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    color: var(--sui-tertiary-foreground-color);
  }
</style>
