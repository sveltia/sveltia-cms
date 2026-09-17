<!--
  @component
  Note shown in a deletion dialog about the entries referencing what’s being deleted — other
  entries, through Relation fields, or assets, through Image, File and Markdown fields: either that
  the references will be removed along with the deletion, or that the deletion can’t go ahead
  because a field would be left invalid, along with the fields in question. Nothing is rendered when
  no entry references what’s being deleted.
-->
<script>
  import { _ } from '@sveltia/i18n';

  /**
   * @import { CascadeDeletePlan } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {CascadeDeletePlan} plan Plan from `planCascadeDelete()` or `planAssetDeletion()`.
   * @property {'entry' | 'asset'} [kind] What’s being deleted.
   * @property {number} count Number of entries or assets being deleted.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    plan,
    kind = 'entry',
    count,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if plan.blockers.length}
  <div role="alert">
    {_(kind === 'asset' ? 'cannot_delete_referenced_assets' : 'cannot_delete_referenced_entries', {
      values: { count },
    })}
  </div>
  <ul class="blockers">
    {#each plan.blockers as blocker (`${blocker.entry.id}:${blocker.keyPath}`)}
      <li>
        <span class="entry"><bdi>{blocker.collectionLabel} › {blocker.summary}</bdi></span>
        <span class="field"><bdi>{blocker.fieldLabel}</bdi>: {blocker.messages.join(' ')}</span>
      </li>
    {/each}
  </ul>
{:else if plan.targets.length}
  <div>
    {_(kind === 'asset' ? 'deleting_referenced_assets_note' : 'deleting_referenced_entries_note', {
      values: { count: plan.targets.length },
    })}
  </div>
{/if}

<style>
  div {
    margin-top: 8px;
  }

  .blockers {
    margin: 8px 0 0;
    border-radius: var(--sui-control-medium-border-radius);
    padding: 12px;
    background-color: var(--sui-tertiary-background-color);
    font-size: var(--sui-font-size-default);
    list-style: none;

    li {
      margin: 0;
      padding: 0;

      &:not(:first-child) {
        margin-top: 8px;
      }
    }

    span {
      display: block;
    }

    .field {
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
