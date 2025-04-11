<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
</script>

<PageContainer aria-label={$_('editorial_workflow')}>
  {#snippet main()}
    <div role="none" class="columns">
      <Group class="column" aria-labelledby="draft-column-title">
        <header role="none">
          <h3 role="none" id="draft-column-title">{$_('status.drafts')}</h3>
        </header>
      </Group>
      <Group class="column" aria-labelledby="review-column-title">
        <header role="none">
          <h3 role="none" id="review-column-title">{$_('status.in_review')}</h3>
        </header>
      </Group>
      <Group class="column" aria-labelledby="ready-column-title">
        <header role="none">
          <h3 role="none" id="ready-column-title">{$_('status.ready')}</h3>
        </header>
      </Group>
    </div>
  {/snippet}
</PageContainer>

<style lang="scss">
  .columns {
    flex: auto;
    display: flex;
    gap: 4px;
    background-color: var(--sui-secondary-background-color); // same as toolbar

    @media (width < 768px) {
      flex-direction: column;
      gap: 0;
    }

    :global {
      .column {
        flex: auto;
        width: calc(100% / 3);
        background-color: var(--sui-primary-background-color);

        @media (width < 768px) {
          width: 100%;
          height: calc(100% / 3);
        }
      }
    }

    header {
      display: flex;
      align-items: center;
      padding: 0 16px;
      height: 40px;
      background-color: var(--sui-tertiary-background-color);

      h3 {
        font-size: var(--sui-font-size-x-large);
      }
    }
  }
</style>
