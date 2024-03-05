<script>
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @type {boolean}
   */
  export let disabled = false;
  /**
   * @type {ListField | ObjectField}
   */
  export let fieldConfig;
  /**
   * @type {object[]}
   */
  export let items = [];
  /**
   * Function to add a new item.
   * @param {string} [typeName] - Variable type name.
   */
  export let addItem = (typeName) => {
    void typeName;
  };

  $: ({
    widget: widgetType,
    name: fieldName,
    label: labelPlural,
    // Widget-specific options
    types,
  } = fieldConfig);

  $: ({ label_singular: labelSingular, max } =
    widgetType === 'list' ? /** @type {ListField} */ (fieldConfig) : /** @type {ListField} */ ({}));
  $: label = $_('add_x', { values: { name: labelSingular || labelPlural || fieldName } });
  $: _disabled = disabled || (typeof max === 'number' && items.length === max);
</script>

{#if Array.isArray(types)}
  <MenuButton variant="tertiary" {label} disabled={_disabled}>
    <Icon slot="start-icon" name="add" />
    <Menu slot="popup" aria-label={$_('select_list_type')}>
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
