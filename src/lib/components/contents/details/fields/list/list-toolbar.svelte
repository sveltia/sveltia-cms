<!--
  @component
  Implement the toolbar above or below the items of a List field with subfield(s): the item count,
  the expander button, the Add and Paste buttons, and the Expand All and Collapse All buttons.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, Spacer } from '@sveltia/ui';

  import ExpandIcon from '$lib/components/common/expand-icon.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { ComplexListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {'top' | 'bottom'} position Where the toolbar is. The top one shows the item count
   * and the expand and collapse buttons, while the bottom one only has the buttons to add an item.
   * @property {HTMLElement} [element] The toolbar element, bound for the parent.
   * @property {string} fieldId ID of the field, to refer to the item list with.
   * @property {string} [summaryId] ID for the item count, which labels the list.
   * @property {ComplexListField} fieldConfig Field configuration.
   * @property {InternalLocaleCode} locale Locale being edited.
   * @property {Record<string, any>[]} items List items.
   * @property {string} fieldName Field name.
   * @property {string | undefined} label Field label.
   * @property {string | undefined} labelSingular Singular field label.
   * @property {boolean} singleItem Whether the list is limited to one item.
   * @property {boolean} parentExpanded Whether the list is expanded.
   * @property {string} parentExpandedKeyPath Key path of the list’s expander state.
   * @property {[string, boolean][]} itemExpanderStates Key path and expander state of each item.
   * @property {boolean} allowAdd Whether items can be added.
   * @property {boolean} addToTop Whether new items are added to the top of the list.
   * @property {boolean} isAddDisabled Whether the Add and Paste buttons are disabled.
   * @property {boolean} hasMaxItems Whether the list is full.
   * @property {(args?: { index?: number, type?: string }) => void} addItem Add an item.
   * @property {(index: number) => void} pasteItem Paste an item at the index.
   * @property {(stateMap: Record<string, boolean>) => void} updateExpanderStates Update the
   * expander states.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    position,
    element = $bindable(),
    fieldId,
    summaryId = undefined,
    fieldConfig,
    locale,
    items,
    fieldName,
    label,
    labelSingular,
    singleItem,
    parentExpanded,
    parentExpandedKeyPath,
    itemExpanderStates,
    allowAdd,
    addToTop,
    isAddDisabled,
    hasMaxItems,
    addItem,
    pasteItem,
    updateExpanderStates,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#snippet pasteButton()}
  {#if !hasMaxItems}
    <Button
      variant="tertiary"
      size="small"
      iconic
      aria-label={_('paste_item')}
      disabled={isAddDisabled}
      onclick={() => pasteItem(addToTop ? 0 : items.length)}
    >
      {#snippet startIcon()}
        <Icon name="content_paste" />
      {/snippet}
    </Button>
  {/if}
{/snippet}

{#if position === 'top'}
  <div role="none" class="toolbar top" class:single={singleItem} bind:this={element}>
    {#if !singleItem}
      <div role="none" class="label">
        <Button
          iconic
          disabled={!items.length}
          aria-label={parentExpanded ? _('collapse') : _('expand')}
          aria-expanded={parentExpanded}
          aria-controls="list-{fieldId}-item-list"
          onclick={() => {
            updateExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
          }}
        >
          {#snippet startIcon()}
            <ExpandIcon expanded={parentExpanded} />
          {/snippet}
        </Button>
        <div role="none" class="summary" id={summaryId}>
          {items.length}
          {(items.length === 1 ? labelSingular : undefined) || label || fieldName}
        </div>
      </div>
    {/if}
    <div role="none" class="actions">
      {#if allowAdd && (addToTop || !items.length || !parentExpanded)}
        <AddItemButton disabled={isAddDisabled} {fieldConfig} {locale} {items} {addItem} />
        {@render pasteButton()}
      {/if}
      {#if parentExpanded && items.length > 1}
        {#each [true, false] as expanded (expanded)}
          <Button
            variant="tertiary"
            size="small"
            label={_(expanded ? 'expand_all' : 'collapse_all')}
            disabled={itemExpanderStates.every(([, value]) => value === expanded)}
            onclick={() => {
              updateExpanderStates(
                Object.fromEntries(itemExpanderStates.map(([key]) => [key, expanded])),
              );
            }}
          />
        {/each}
      {/if}
    </div>
  </div>
{:else}
  <div role="none" class="toolbar bottom add">
    <Spacer flex />
    <AddItemButton disabled={isAddDisabled} {fieldConfig} {locale} {items} {addItem} />
    {@render pasteButton()}
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 8px;
    position: sticky;
    z-index: 10;
    background-color: var(--sui-primary-background-color);
    min-height: var(--sui-secondary-toolbar-size);

    &.top {
      /* Below the sticky toolbars of the rich text editors the field is in, if any */
      top: var(--sui-text-editor-inner-toolbar-top, 0);
    }

    &.bottom {
      bottom: 0;
    }

    & > div {
      display: flex;
      align-items: center;

      &.actions {
        flex-wrap: wrap;
        margin-block: 8px;
        margin-inline-start: auto;
      }
    }

    &.single > div.actions {
      /* With no item count on the left, the Add button goes where the item would be */
      margin-inline-start: 0;
    }
  }
</style>
