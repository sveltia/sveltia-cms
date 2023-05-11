<script>
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
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
  class="tertiary"
  disabled={max && items.length === max}
  label={$_('add_x', { values: { name: labelSingular || label } })}
  on:click={hasTypes ? undefined : () => addItem()}
>
  <Icon slot="start-icon" name="add" />
  <svelte:component this={hasTypes ? Menu : undefined} slot="popup">
    {#each types as { name, label: _label } (name)}
      <MenuItem label={_label} on:click={() => addItem(name)} />
    {/each}
  </svelte:component>
</svelte:component>
