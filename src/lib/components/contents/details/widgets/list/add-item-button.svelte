<script>
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @type {boolean}
   */
  export let disabled = false;
  /**
   * @type {ListField}
   */
  export let fieldConfig;
  /**
   * @type {object[]}
   */
  export let items = [];
  /**
   * @param {string} [name] Item name.
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  export let addItem = (name) => undefined;

  $: ({
    label: labelPlural,
    // Widget-specific options
    label_singular: labelSingular,
    max,
    types,
  } = fieldConfig);

  $: label = $_('add_x', { values: { name: labelSingular || labelPlural } });
  $: _disabled = disabled || (typeof max === 'number' && items.length === max);
</script>

{#if Array.isArray(types)}
  <MenuButton variant="tertiary" {label} disabled={_disabled}>
    <Icon slot="start-icon" name="add" />
    <Menu slot="popup">
      {#each types as { name, label: itemLabel } (name)}
        <MenuItem label={itemLabel} on:click={() => addItem(name)} />
      {/each}
    </Menu>
  </MenuButton>
{:else}
  <Button variant="tertiary" {label} disabled={_disabled} on:click={() => addItem()}>
    <Icon slot="start-icon" name="add" />
  </Button>
{/if}
