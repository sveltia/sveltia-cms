<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Icon, Toast } from '@sveltia/ui';
  import { matchesShortcuts } from '@sveltia/utils/events';

  import { hasMouse } from '$lib/services/user/env';

  /**
   * @typedef {object} Props
   * @property {boolean} allowDrop Whether to allow dropping files.
   * @property {boolean} invalid Whether the field is invalid.
   * @property {boolean} readonly Whether the field is readonly.
   * @property {boolean} processing Whether the field is processing.
   * @property {boolean} isImageField Whether the field is an image field.
   * @property {boolean} multiple Whether the field allows multiple files.
   * @property {boolean} showSelectAssetsDialog Whether to show the select assets dialog.
   * @property {boolean} replaceMode Whether the dialog is in replace mode.
   * @property {(file: File) => void} [onFilePaste] Callback invoked when an image is pasted from
   * the clipboard instead of opening the asset selection dialog.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    allowDrop,
    invalid,
    readonly,
    processing,
    isImageField,
    multiple,
    showSelectAssetsDialog = $bindable(false),
    replaceMode = $bindable(false),
    onFilePaste = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const toast = $state({ show: false, message: '' });
  const disabled = $derived(readonly || processing);

  /**
   * Handle click on the paste button. If `onFilePaste` is provided, it will attempt to read an
   * image from the clipboard and invoke the callback with the pasted file.
   */
  const onPasteButtonClick = async () => {
    if (disabled || !onFilePaste) {
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      /** @type {string | undefined} */
      let imageType;

      const imageItem = clipboardItems.find((item) =>
        item.types.some((type) => {
          const isImage = type.startsWith('image/');

          if (isImage) {
            imageType = type;
          }

          return isImage;
        }),
      );

      if (imageItem && imageType) {
        const blob = await imageItem.getType(imageType);
        const ext = imageType.split('/')[1].replace('+xml', '');
        const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: imageType });

        onFilePaste(file);

        return;
      }

      Object.assign(toast, {
        message: _('no_image_in_clipboard'),
        show: true,
      });
    } catch {
      Object.assign(toast, {
        message: _('clipboard_access_denied'),
        show: true,
      });
    }
  };
</script>

{#snippet buttons()}
  <div role="none" class="buttons">
    <Button
      label={_('browse')}
      variant="tertiary"
      size="small"
      {disabled}
      onclick={(event) => {
        event.stopPropagation();
        replaceMode = false;
        showSelectAssetsDialog = true;
      }}
    />
    {#if onFilePaste}
      <Button
        label={_(isImageField ? 'paste' : 'paste_image')}
        variant="tertiary"
        size="small"
        {disabled}
        onclick={(event) => {
          event.stopPropagation();
          onPasteButtonClick();
        }}
      />
    {/if}
  </div>
{/snippet}

<div role="none" class="empty" class:invalid class:processing>
  <Button
    flex
    role="button"
    variant="tertiary"
    {disabled}
    tabindex="0"
    onclick={() => {
      if ($hasMouse) {
        replaceMode = false;
        showSelectAssetsDialog = true;
      }
    }}
    onkeydown={(event) => {
      if (matchesShortcuts(event, 'Accel+V')) {
        event.preventDefault();
        onPasteButtonClick();
      }
    }}
  >
    <Icon name="cloud_upload" />
    <div role="none" class="label">
      {#if processing}
        <div role="status">
          {_('processing_files', { values: { count: multiple ? 2 : 1 } })}
        </div>
      {:else if $hasMouse}
        {#if !allowDrop}
          {_('click_to_browse')}
        {:else if isImageField}
          {_('drop_image_files_or', { values: { count: multiple ? 2 : 1 } })}
        {:else}
          {_('drop_files_or', { values: { count: multiple ? 2 : 1 } })}
        {/if}
        {@render buttons()}
      {:else}
        {@render buttons()}
      {/if}
    </div>
  </Button>
</div>

<Toast bind:show={toast.show}>
  <Alert status="error">
    {toast.message}
  </Alert>
</Toast>

<style lang="scss">
  .empty {
    :global {
      & > button {
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

        @media (pointer: coarse) {
          &:active,
          &:focus {
            // Reset the style because the button is disabled on mobile
            background-color: var(--sui-button-background-color);
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

  .label {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0 4px;
    white-space: nowrap;

    :global {
      .button {
        margin-block: 0;
      }
    }
  }
</style>
