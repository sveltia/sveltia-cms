<script>
  import { Alert, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import { panels } from '$lib/components/settings';

  let toastMessage = $state('');
  let showToast = $state(false);
</script>

<PageContainer class="content" aria-label={$_('settings')}>
  {#snippet main()}
    <div role="none" class="wrapper">
      {#each panels as { key, component: Content } (key)}
        <section>
          <h3>{$_(`prefs.${key}.title`)}</h3>
          <div role="none" class="inner">
            <Content
              onChange={(/** @type {{ message: string }} */ { message }) => {
                toastMessage = message;
                showToast = true;
              }}
            />
          </div>
        </section>
      {/each}
    </div>
  {/snippet}
</PageContainer>

<Toast bind:show={showToast}>
  <Alert status="success">{toastMessage}</Alert>
</Toast>

<style lang="scss">
  .wrapper {
    overflow-y: auto;
    width: 100%;
    height: 100%;
  }

  section {
    h3 {
      padding: 8px 16px;
      background-color: var(--sui-tertiary-background-color);
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-normal);
    }

    .inner {
      padding: 16px;

      :global(section:not(:first-child)) {
        margin: 16px 0 0;
      }

      :global(p) {
        margin-top: 0;
      }

      :global(h4) {
        font-size: inherit;

        & ~ :global(div) {
          margin: 8px 0 0;
        }

        & ~ :global(p) {
          margin: 8px 0 0;
          color: var(--sui-secondary-foreground-color);
          font-size: var(--sui-font-size-small);
        }
      }
    }
  }
</style>
