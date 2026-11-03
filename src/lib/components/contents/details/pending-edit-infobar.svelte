<!--
  @component
  Notice shown at the top of the entry editor when the entry has been edited from a Relation field
  of another entry, and the changes wait in that entry’s pull request to be published along with it.
  The user can still save the entry on its own; Git then combines the two changes when the pull
  request is published, or refuses to if they touch the same lines.
  @see https://github.com/sveltia/sveltia-cms/issues/1129
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Infobar } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getEditingHostName } from '$lib/services/contents/fields/relation/quick-add';

  const entryDraft = getEntryDraftContext();
  const hostName = $derived(getEditingHostName(entryDraft.current));
</script>

{#if hostName !== undefined}
  <Infobar status="warning" --sui-infobar-message-justify-content="center">
    {_('relation_field.edited_with_entry', { values: { name: hostName } })}
  </Infobar>
{/if}
