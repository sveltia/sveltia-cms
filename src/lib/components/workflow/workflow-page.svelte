<script>
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
</script>

<PageContainer class="content">
  <svelte:fragment slot="main">
    <div class="columns" aria-label={$_('editorial_workflow')}>
      <div class="column">
        <header>
          <h3>{$_('status.drafts')}</h3>
        </header>
      </div>
      <div class="column">
        <header>
          <h3>{$_('status.in_review')}</h3>
        </header>
      </div>
      <div class="column">
        <header>
          <h3>{$_('status.ready')}</h3>
        </header>
      </div>
    </div>
  </svelte:fragment>
</PageContainer>

<style lang="scss">
  .columns {
    flex: auto;
    display: flex;

    .column {
      flex: auto;
      width: calc(100% / 3);

      &:not(:last-child) {
        border-width: 0 1px 0 0;
        border-color: var(--primary-border-color);
      }

      header {
        display: flex;
        align-items: center;
        border-width: 0 0 1px 0;
        border-color: var(--primary-border-color);
        padding: 0 16px;
        height: 40px;
        background-color: var(--ternary-background-color);
      }
    }
  }
</style>
