<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  let {
    currentSubPath = $bindable(''),
    rootLabel = '',
    showUpButton = false,
    showCreateButton = false,
    onCreateFolder = () => {},
    onNavigate = () => {},
    onNavigateUp = () => {},
  } = $props();

  const breadcrumbSegments = $derived(currentSubPath ? ['', ...currentSubPath.split('/')] : ['']);

  const navigateUp = () => {
    const segments = currentSubPath.split('/');

    segments.pop();
    currentSubPath = segments.join('/');
    onNavigateUp();
  };

  const navigateToSegment = (index) => {
    if (index === 0) {
      currentSubPath = '';
    } else {
      currentSubPath = breadcrumbSegments.slice(1, index + 1).join('/');
    }

    onNavigate();
  };
</script>

<div role="navigation" class="breadcrumb" aria-label="Folder navigation">
  <span class="segments">
    {#each breadcrumbSegments as segment, index}
      {#if index > 0}
        <Icon name="chevron_right" />
      {/if}
      <button
        class="crumb"
        class:active={index === breadcrumbSegments.length - 1}
        onclick={() => navigateToSegment(index)}
      >
        {index === 0 ? rootLabel : decodeURIComponent(segment)}
      </button>
    {/each}
  </span>
  {#if showUpButton}
    <Button variant="text" size="small" label={_('go_up')} onclick={navigateUp} />
  {/if}
  {#if showCreateButton}
    <Button
      variant="text"
      size="small"
      label={_('assets_dialog.create_folder')}
      onclick={onCreateFolder}
    />
  {/if}
</div>

<style lang="scss">
  .breadcrumb {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: var(--breadcrumb-padding, 8px 16px);
    border-bottom: 1px solid var(--sui-control-border-color);
    margin-bottom: var(--breadcrumb-margin-bottom, 0);

    .segments {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: auto;

      .crumb {
        cursor: pointer;
        border: none;
        border-radius: 4px;
        padding: 2px 6px;
        color: var(--sui-link-color);
        background: none;
        font-size: var(--sui-font-size-small);
        font-family: inherit;

        &:hover {
          text-decoration: underline;
        }

        &.active {
          cursor: default;
          color: var(--sui-primary-foreground-color);
          font-weight: var(--sui-font-weight-semi-bold);

          &:hover {
            text-decoration: none;
          }
        }
      }
    }
  }
</style>
