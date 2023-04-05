<script>
  import {
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    SelectButton,
    SelectButtonGroup,
    Separator,
    Spacer,
    Toolbar,
  } from '@sveltia/ui';
  import equal from 'deep-is';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';
  import CopyMenuItem from '$lib/components/contents/details/editor/copy-menu-item.svelte';
  import { siteConfig } from '$lib/services/config';
  import { entryDraft, entryViewSettings, revertChanges } from '$lib/services/contents/editor';
  import { getLocaleLabel } from '$lib/services/i18n';

  export let thisPane = writable({});
  export let thatPane = writable({});

  $: ({ collection, collectionFile, currentValues, originalValues, validities } =
    $entryDraft || {});
  $: otherLocales = ($siteConfig.i18n?.locales || []).filter((l) => l !== $thisPane.locale);
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;
  $: canCopy = !!otherLocales.length;
  $: canRevert = !equal(currentValues[$thisPane.locale], originalValues[$thisPane.locale]);
</script>

<div class="header">
  <Toolbar class="secondary">
    {#if $siteConfig.i18n?.locales?.length}
      <!-- @todo Use a dropdown list when there are 5+ locales. -->
      <SelectButtonGroup>
        {#each $siteConfig.i18n?.locales as locale}
          {@const localeLabel = getLocaleLabel(locale)}
          {@const invalid = Object.values(validities[locale]).some(({ valid }) => !valid)}
          {#if !($thatPane.mode === 'edit' && $thatPane.locale === locale)}
            <SelectButton
              selected={$thisPane.mode === 'edit' && $thisPane.locale === locale}
              class="secondary small {invalid ? 'error' : ''}"
              label={invalid
                ? $_('edit_x_error', { values: { locale: localeLabel } })
                : localeLabel}
              on:click={() => {
                $thisPane = { mode: 'edit', locale };

                if ($thatPane.mode === 'preview') {
                  $thatPane = { mode: 'preview', locale };
                }
              }}
            />
          {/if}
        {/each}
        {#if $thatPane.mode === 'edit' && canPreview && $entryViewSettings.showPreview}
          <SelectButton
            selected={$thisPane.mode === 'preview'}
            class="secondary small"
            label={$_('preview')}
            on:click={() => {
              $thisPane = { mode: 'preview', locale: $thatPane.locale };
            }}
          />
        {/if}
      </SelectButtonGroup>
    {:else}
      <h3>{$thisPane.mode === 'preview' ? $_('preview') : $_('edit')}</h3>
    {/if}
    <Spacer flex={true} />
    {#if $thisPane.mode === 'edit'}
      <MenuButton class="ternary iconic" popupPosition="bottom-right">
        <Icon slot="start-icon" name="more_vert" label={$_('show_menu')} />
        <Menu slot="popup">
          {#if canCopy}
            <CopyMenuItem locale={$thisPane.locale} translate={true} />
            {#if otherLocales.length > 1}
              <Separator />
            {/if}
            <CopyMenuItem locale={$thisPane.locale} />
            <Separator />
          {/if}
          <MenuItem
            label={$_('revert_changes')}
            disabled={!canRevert}
            on:click={() => {
              revertChanges($thisPane.locale);
            }}
          />
        </Menu>
      </MenuButton>
    {/if}
  </Toolbar>
</div>

<style lang="scss">
  .header {
    flex: none !important;

    & > :global([role='toolbar']) {
      :global(h3) {
        font-size: 14px;
      }

      :global(button.error) {
        color: var(--danger-foreground-color);
      }
    }
  }
</style>
