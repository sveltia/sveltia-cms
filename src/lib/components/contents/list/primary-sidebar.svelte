<script>
  import { Icon, Listbox, Option } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
  import { selectedCollection } from '$lib/services/contents';

  $: collections = $siteConfig?.collections.filter(({ hide }) => !hide) ?? [];
</script>

<div role="none" class="primary-sidebar">
  <Listbox aria-label={$_('collections')} aria-controls="collection-container">
    {#each collections as { name, label, icon, hide = false } (name)}
      {#if !hide}
        <Option
          label={label || name}
          selected={$selectedCollection?.name === name}
          on:select={() => {
            goto(`/collections/${name}`);
          }}
        >
          <Icon slot="start-icon" name={icon || 'edit_note'} />
        </Option>
      {/if}
    {/each}
  </Listbox>
</div>
