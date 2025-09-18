<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { hasMouse } from '$lib/services/user/env';

  /**
   * @typedef {object} Props
   * @property {boolean} invalid Whether the field is invalid.
   * @property {boolean} readonly Whether the field is readonly.
   * @property {boolean} processing Whether the field is processing.
   * @property {boolean} isImageWidget Whether the widget is an image widget.
   * @property {boolean} multiple Whether the field allows multiple files.
   * @property {boolean} showSelectAssetsDialog Whether to show the select assets dialog.
   * @property {boolean} replaceMode Whether the dialog is in replace mode.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    invalid,
    readonly,
    processing,
    isImageWidget,
    multiple,
    showSelectAssetsDialog = $bindable(false),
    replaceMode = $bindable(false),
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="empty" class:invalid class:processing>
  <Button
    flex
    role="button"
    variant="tertiary"
    disabled={readonly || processing}
    tabindex="0"
    onclick={() => {
      if (!readonly) {
        replaceMode = false;
        showSelectAssetsDialog = true;
      }
    }}
  >
    <Icon name="cloud_upload" />
    <div role="none">
      {#if processing}
        <div role="status">
          {$_('processing_file')}
        </div>
      {:else if $hasMouse}
        {#if isImageWidget}
          {$_(`drop_image_${multiple ? 'files' : 'file'}_or_click_to_browse`)}
        {:else}
          {$_(`drop_${multiple ? 'files' : 'file'}_or_click_to_browse`)}
        {/if}
      {:else}
        {$_('tap_to_browse')}
      {/if}
    </div>
  </Button>
</div>

<style lang="scss">
  .empty {
    :global {
      button {
        flex-direction: column;
        justify-content: center;
        height: 120px;
        font-size: var(--sui-font-size-small);

        .icon {
          color: var(--sui-secondary-foreground-color);
          font-size: 48px;
        }

        &:disabled {
          pointer-events: none !important;

          :global(*) {
            opacity: 0.5;
          }
        }
      }
    }

    &.invalid {
      :global {
        button {
          border-color: var(--sui-error-border-color);
        }
      }
    }
  }
</style>
