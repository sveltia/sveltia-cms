<script>
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let fieldConfig = {};
  export let items = [];
  // eslint-disable-next-line jsdoc/require-jsdoc, no-unused-vars
  export let addItem = (name) => undefined;

  $: ({
    label: labelPlural,
    // Widget-specific options
    label_singular: labelSingular,
    max,
    types,
  } = fieldConfig);

  $: label = $_('add_x', { values: { name: labelSingular || labelPlural } });
  $: disabled = max && items.length === max;
</script>

{#if Array.isArray(types)}
  <MenuButton class="tertiary" {label} {disabled}>
    <Icon slot="start-icon" name="add" />
    <Menu slot="popup">
      {#each types as { name, label: itemLabel } (name)}
        <MenuItem label={itemLabel} on:click={() => addItem(name)} />
      {/each}
    </Menu>
  </MenuButton>
{:else}
  <Button class="tertiary" {label} {disabled} on:click={() => addItem()}>
    <Icon slot="start-icon" name="add" />
  </Button>
{/if}
