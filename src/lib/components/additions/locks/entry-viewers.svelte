<!--
  @component
  The other people who have the entry open in the editor, read-only or not, as avatars showing
  their initials.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import Avatar from '$lib/components/common/avatar.svelte';
  import { getDraftLockKey, getOtherViewers } from '$lib/services/additions/locks.svelte';
  import { formatNames } from '$lib/services/additions/people';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';

  /**
   * Most avatars shown; the others are counted.
   */
  const MAX_AVATARS = 3;

  const entryDraft = getEntryDraftContext();
  const people = $derived(getOtherViewers(getDraftLockKey(entryDraft.current)));
  const label = $derived(
    _('additions.locks.also_open_by_x', { values: { names: formatNames(people) } }),
  );
</script>

{#if people.length}
  <div role="img" class="viewers" aria-label={label} title={label}>
    {#each people.slice(0, MAX_AVATARS) as { id, name } (id)}
      <Avatar {name} size={28} class="stacked" />
    {/each}
    {#if people.length > MAX_AVATARS}
      <Avatar text="+{people.length - MAX_AVATARS}" size={28} class="stacked more" />
    {/if}
  </div>
{/if}

<style>
  .viewers {
    display: inline-flex;
    flex: none;
    align-items: center;
    /* Apart from the buttons that follow, e.g. Save, which would otherwise nearly touch it */
    margin-inline-end: 8px;
  }

  /* Overlapping, each with a ring in the background color to tell them apart */
  .viewers :global(.stacked) {
    border: 2px solid var(--sui-primary-background-color);

    &:not(:first-child) {
      margin-inline-start: -8px;
    }
  }
</style>
