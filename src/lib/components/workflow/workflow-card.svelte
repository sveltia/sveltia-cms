<!--
  @component A card representing an entry in the workflow board.
-->
<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { goto } from '$lib/services/app/navigation';
  import {
    getNextStatuses,
    transitionEntry,
    workflowStatuses,
    TRANSITION_LABEL_KEYS,
    TRANSITION_ICONS,
  } from '$lib/services/contents/workflow';

  /**
   * @import { Entry, InternalCollection } from '$lib/types/private';
   * @import { WorkflowStatus } from '$lib/services/contents/workflow';
   */

  /**
   * @typedef {object} Props
   * @property {Entry} entry The entry to display.
   * @property {InternalCollection} [collection] The collection this entry belongs to.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    collection,
    /* eslint-enable prefer-const */
  } = $props();

  const title = $derived(
    entry.locales?.[Object.keys(entry.locales)[0]]?.content?.title ??
      entry.locales?.[Object.keys(entry.locales)[0]]?.content?.name ??
      entry.slug ??
      entry.id ??
      'Untitled',
  );

  const collectionLabel = $derived(collection?.label ?? collection?.name ?? '');
  // Use reactive $workflowStatuses subscription for live updates
  const currentStatus = $derived($workflowStatuses?.get?.(entry.id ?? '') ?? 'draft');
  const nextStatuses = $derived(getNextStatuses(currentStatus));

  /**
   * Navigate to the entry editor.
   */
  const openEntry = () => {
    if (collection && entry.slug) {
      const basePath =
        collection._type === 'entry'
          ? `/collections/${collection.name}/entries/${entry.slug}`
          : `/collections/${collection.name}`;

      goto(basePath);
    }
  };

  /**
   * Transition the entry to the given status.
   * @param {WorkflowStatus} status Target status.
   */
  const handleTransition = (status) => {
    if (entry.id) {
      transitionEntry(entry.id, status);
    }
  };
</script>

<div
  role="listitem"
  class="workflow-card"
  draggable="true"
  data-entry-id={entry.id}
  ondragstart={(e) => {
    if (e.dataTransfer && entry.id) {
      e.dataTransfer.setData('text/plain', entry.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  }}
>
  <button type="button" class="card-body" onclick={openEntry}>
    <div class="card-header">
      <span class="collection-label">{collectionLabel}</span>
    </div>
    <h4 class="card-title">{title}</h4>
    {#if entry.slug}
      <span class="card-slug">{entry.slug}</span>
    {/if}
  </button>
  <div class="card-actions">
    {#each nextStatuses as status (status)}
      <Button
        variant="ghost"
        size="small"
        label={$_(TRANSITION_LABEL_KEYS[status] ?? status)}
        onclick={() => handleTransition(status)}
      >
        {#snippet startIcon()}
          <Icon name={TRANSITION_ICONS[status] ?? 'arrow_forward'} />
        {/snippet}
      </Button>
    {/each}
  </div>
</div>

<style lang="scss">
  .workflow-card {
    display: flex;
    flex-direction: column;
    margin: 8px;
    border: 1px solid var(--sui-control-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    background-color: var(--sui-primary-background-color);
    transition: box-shadow 0.2s, opacity 0.2s;
    cursor: grab;

    &:hover {
      box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
    }

    &:active {
      cursor: grabbing;
    }
  }

  .card-body {
    all: unset;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--sui-primary-accent-color);
      outline-offset: -2px;
      border-radius: var(--sui-control-medium-border-radius)
        var(--sui-control-medium-border-radius) 0 0;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .collection-label {
    font-size: var(--sui-font-size-x-small);
    color: var(--sui-tertiary-foreground-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-title {
    font-size: var(--sui-font-size-default);
    font-weight: 600;
    color: var(--sui-primary-foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-slug {
    font-size: var(--sui-font-size-small);
    color: var(--sui-secondary-foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-actions {
    display: flex;
    gap: 4px;
    padding: 4px 8px 8px;
    border-top: 1px solid var(--sui-control-border-color);
  }
</style>
