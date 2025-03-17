<script>
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @import { ListField, ObjectField } from '$lib/typedefs/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {ListField | ObjectField} fieldConfig Field configuration.
   * @property {object[]} [items] List items. `<ListEditor>` only.
   * @property {(args?: { type?: string }) => void} [addItem] Function to add a new item.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    fieldConfig,
    items = [],
    addItem = () => undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    widget: widgetType,
    name: fieldName,
    label: labelPlural,
    // Widget-specific options
    types,
  } = $derived(fieldConfig);
  const listField = $derived(
    widgetType === 'list' ? /** @type {ListField} */ (fieldConfig) : undefined,
  );
  const labelSingular = $derived(listField?.label_singular ?? '');
  const max = $derived(listField?.max ?? undefined);
  const label = $derived(
    $_('add_x', { values: { name: labelSingular || labelPlural || fieldName } }),
  );
  const _disabled = $derived(disabled || (typeof max === 'number' && items.length === max));
</script>

{#if Array.isArray(types)}
  <MenuButton variant="tertiary" {label} disabled={_disabled}>
    {#snippet startIcon()}
      <Icon name="add" />
    {/snippet}
    {#snippet endIcon()}{/snippet}
    {#snippet popup()}
      <Menu aria-label={$_('select_list_type')}>
        {#each types as { name, label: itemLabel } (name)}
          <MenuItem label={itemLabel || name} onclick={() => addItem({ type: name })} />
        {/each}
      </Menu>
    {/snippet}
  </MenuButton>
{:else}
  <Button variant="tertiary" {label} disabled={_disabled} onclick={() => addItem()}>
    {#snippet startIcon()}
      <Icon name="add" />
    {/snippet}
  </Button>
{/if}
