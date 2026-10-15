<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  /**
   * @import { FieldWithTypes, KeyValueField, ListField, ObjectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {ListField | ObjectField | KeyValueField} fieldConfig Field configuration.
   * @property {unknown[]} [items] List items or key-value pairs. `<ListEditor>` and
   * `<KeyValueEditor>` only.
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
  // A List or KeyValue field can be given a singular label and a maximum number of items
  const multiValueField = $derived(fieldConfig.widget === 'object' ? undefined : fieldConfig);
  const labelSingular = $derived(multiValueField?.label_singular ?? '');
  const max = $derived(multiValueField?.max ?? Infinity);
  const label = $derived(
    _('add_x', { values: { name: labelSingular || labelPlural || fieldName } }),
  );
  // Hide the button instead of disabling it once the list is full, as a disabled button confuses
  // users, especially when `max` is `1`
  const hasMaxItems = $derived(items.length >= max);

  const menuId = $props.id();
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
        {#each types as { name, label: itemLabel, description }, index (name)}
          {#if description}
            {@const descriptionId = `${menuId}-type-${index}-description`}
            <!-- The description isn’t part of the item’s name, but describes it -->
            <MenuItem
              class="variable-type-described"
              aria-label={itemLabel || name}
              aria-describedby={descriptionId}
              onclick={() => addItem({ type: name })}
            >
              <span role="none" class="type-label">{itemLabel || name}</span>
              <span role="none" class="type-description" id={descriptionId}>{description}</span>
            </MenuItem>
          {:else}
            <MenuItem label={itemLabel || name} onclick={() => addItem({ type: name })} />
          {/if}
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

<style>
  :global(.sui.menuitem.variable-type-described) {
    --sui-menuitem-height: auto;
    --sui-menuitem-padding: 8px 16px;

    :global(.content) {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  }

  .type-description {
    max-width: 320px;
    white-space: normal;
    text-align: start;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
    color: var(--sui-tertiary-foreground-color);
  }

  :global(button:hover) .type-description {
    color: inherit;
  }
</style>
