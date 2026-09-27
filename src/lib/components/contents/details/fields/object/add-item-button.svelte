<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  /**
   * @import { FieldWithTypes, ListField, ObjectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {ListField | ObjectField} fieldConfig Field configuration.
   * @property {unknown[]} [items] List items. `<ListEditor>` only.
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

  const { name: fieldName, label: labelPlural } = $derived(fieldConfig);
  const { types } = $derived(/** @type {FieldWithTypes} */ (fieldConfig));
  const listField = $derived(fieldConfig.widget === 'list' ? fieldConfig : undefined);
  const labelSingular = $derived(listField?.label_singular ?? '');
  const max = $derived(listField?.max ?? Infinity);
  const label = $derived(
    _('add_x', { values: { name: labelSingular || labelPlural || fieldName } }),
  );
  // Hide the button instead of disabling it once the list is full, as a disabled button confuses
  // users, especially when `max` is `1`
  const hasMaxItems = $derived(items.length >= max);
</script>

{#if hasMaxItems}
  <!-- The list is full -->
{:else if Array.isArray(types)}
  <MenuButton variant="tertiary" size="small" {label} {disabled}>
    {#snippet startIcon()}
      <Icon name="add" />
    {/snippet}
    {#snippet endIcon()}{/snippet}
    {#snippet popup()}
      <Menu ariaLabel={_('select_list_type')}>
        {#each types as { name, label: itemLabel } (name)}
          <MenuItem label={itemLabel || name} onclick={() => addItem({ type: name })} />
        {/each}
      </Menu>
    {/snippet}
  </MenuButton>
{:else}
  <Button variant="tertiary" size="small" {label} {disabled} onclick={() => addItem()}>
    {#snippet startIcon()}
      <Icon name="add" />
    {/snippet}
  </Button>
{/if}
