<script>
  import { Group, Listbox, Option } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { selectedCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';

  $: collections = $siteConfig.collections.filter(({ hide }) => !hide);
</script>

<Group class="primary-sidebar">
  <section>
    <h2>{$_('collections')}</h2>
    <Listbox>
      {#each collections as { name, label, icon, hide = false } (name)}
        {#if !hide}
          <Option
            iconName={icon || 'edit_note'}
            {label}
            selected={$selectedCollection.name === name}
            on:click={() => {
              goto(`/collections/${name}`);
            }}
          />
        {/if}
      {/each}
    </Listbox>
  </section>
</Group>
