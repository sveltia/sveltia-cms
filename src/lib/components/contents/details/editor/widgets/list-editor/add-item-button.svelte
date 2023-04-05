<script>
  import { Button, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let fieldConfig = {};
  export let items = [];
  // eslint-disable-next-line jsdoc/require-jsdoc
  export let addItem = () => undefined;

  $: ({
    label,
    // Widget-specific options
    label_singular: labelSingular,
    max,
    types,
  } = fieldConfig);
  $: hasTypes = Array.isArray(types);
</script>

<svelte:component
  this={hasTypes ? MenuButton : Button}
  class="secondary"
  disabled={max && items.length === max}
  iconName="add"
  label={$_('add_x', { values: { name: labelSingular || label } })}
  on:click={hasTypes ? undefined : () => addItem()}
>
  {#if hasTypes}
    {#each types as { name, label } (name)}
      <MenuItem {label} on:click={() => addItem(name)} />
    {/each}
  {/if}
</svelte:component>
