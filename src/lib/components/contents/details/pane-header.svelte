<script>
  import {
    Divider,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    SelectButton,
    SelectButtonGroup,
    Spacer,
    Toolbar,
  } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';
  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import { backend } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import {
    entryDraft,
    entryEditorSettings,
    revertChanges,
    toggleLocale,
  } from '$lib/services/contents/editor';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * The wrapper element’s `id` attribute.
   * @type {string}
   */
  export let id;
  /**
   * This pane’s locale and mode.
   * @type {import('svelte/store').Writable<?EntryEditorPane>}
   */
  export let thisPane;
  /**
   * @type {import('svelte/store').Writable<?EntryEditorPane>}
   */
  export let thatPane = writable(null);

  /** @type {MenuButton} */
  let menuButton;

  $: ({ editor: { preview: showPreviewPane = true } = {} } =
    $siteConfig ?? /** @type {SiteConfig} */ ({}));
  $: ({
    collection,
    collectionFile,
    originalEntry,
    currentLocales = {},
    currentValues = {},
    originalValues = {},
    validities = {},
  } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ i18nEnabled, saveAllLocales, locales, defaultLocale } =
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: isLocaleEnabled = currentLocales[$thisPane?.locale ?? ''];
  $: isOnlyLocale = Object.values(currentLocales).filter((enabled) => enabled).length === 1;
  $: otherLocales = i18nEnabled ? locales.filter((l) => l !== $thisPane?.locale) : [];
  $: canPreview = (collectionFile ?? collection)?.editor?.preview ?? showPreviewPane;
  $: canCopy = !!otherLocales.length;
  $: canRevert =
    $thisPane?.locale &&
    !equal(currentValues[$thisPane?.locale], originalValues[$thisPane?.locale]);
</script>

<div role="none" {id} class="header">
  <Toolbar variant="secondary" aria-label={$_('secondary')}>
    {#if i18nEnabled}
      <!-- @todo Use a dropdown list when there are 5+ locales. -->
      <SelectButtonGroup
        aria-label={$_('switch_locale')}
        aria-controls={id.replace('-header', '-body')}
      >
        {#each locales as locale}
          {@const localeLabel = getLocaleLabel(locale)}
          {@const invalid = Object.values(validities[locale]).some(({ valid }) => !valid)}
          {#if !($thatPane?.mode === 'edit' && $thatPane?.locale === locale)}
            <SelectButton
              selected={$thisPane?.mode === 'edit' && $thisPane?.locale === locale}
              variant="tertiary"
              size="small"
              class={invalid ? 'error' : ''}
              label={localeLabel}
              on:select={() => {
                $thisPane = { mode: 'edit', locale };

                if ($thatPane?.mode === 'preview') {
                  $thatPane = { mode: 'preview', locale };
                }
              }}
            >
              {#if invalid}
                <Icon slot="end-icon" name="error" aria-label={$_('locale_content_errors')} />
              {/if}
            </SelectButton>
          {/if}
        {/each}
        {#if $thatPane?.mode === 'edit' && canPreview && $entryEditorSettings?.showPreview}
          <SelectButton
            selected={$thisPane?.mode === 'preview'}
            variant="tertiary"
            size="small"
            label={$_('preview')}
            on:select={() => {
              $thisPane = { mode: 'preview', locale: $thatPane?.locale ?? '' };
            }}
          />
        {/if}
      </SelectButtonGroup>
    {:else}
      <h3 role="none">{$thisPane?.mode === 'preview' ? $_('preview') : $_('edit')}</h3>
    {/if}
    <Spacer flex />
    {#if $thisPane?.mode === 'edit'}
      {@const localeLabel = getLocaleLabel($thisPane?.locale)}
      <MenuButton
        variant="ghost"
        iconic
        popupPosition="bottom-right"
        aria-label={$_('show_content_options_x_locale', { values: { locale: localeLabel } })}
        bind:this={menuButton}
      >
        <Icon slot="start-icon" name="more_vert" />
        <Menu
          slot="popup"
          aria-label={$_('content_options_x_locale', { values: { locale: localeLabel } })}
        >
          {#if canCopy}
            <CopyMenuItems anchor={menuButton} locale={$thisPane?.locale} translate={true} />
            {#if otherLocales.length > 1}
              <Divider />
            {/if}
            <CopyMenuItems anchor={menuButton} locale={$thisPane?.locale} />
          {/if}
          <MenuItem
            label={$_('revert_changes')}
            disabled={!canRevert}
            on:click={() => {
              revertChanges($thisPane?.locale);
            }}
          />
          {#if !saveAllLocales}
            <Divider />
            <MenuItem
              label={$_(
                // eslint-disable-next-line no-nested-ternary
                isLocaleEnabled
                  ? 'disable_x_locale'
                  : currentValues[$thisPane?.locale]
                    ? 'reenable_x_locale'
                    : 'enable_x_locale',
                { values: { locale: localeLabel } },
              )}
              disabled={$thisPane?.locale === defaultLocale || (isLocaleEnabled && isOnlyLocale)}
              on:click={() => {
                toggleLocale($thisPane?.locale ?? '');
              }}
            />
          {/if}
          {#if originalEntry}
            <Divider />
            <MenuItem
              disabled={!$backend?.repository}
              label={$_('view_on_x', {
                values: { service: $backend?.repository?.label },
                default: $_('view_in_repository'),
              })}
              on:click={() => {
                if (originalEntry && $thisPane) {
                  window.open(
                    `${$backend?.repository?.blobBaseURL}/` +
                      `${originalEntry.locales[$thisPane.locale].path}?plain=1`,
                  );
                }
              }}
            />
          {/if}
        </Menu>
      </MenuButton>
    {/if}
  </Toolbar>
</div>

<style lang="scss">
  .header {
    flex: none !important;
    background-color: var(--sui-tertiary-background-color);

    & > :global([role='toolbar']) {
      margin-right: auto;
      margin-left: auto;
      max-width: 800px;

      :global(h3) {
        margin: 0 8px;
        font-size: var(--sui-font-size-default);
      }

      :global(button.error) {
        color: var(--sui-error-foreground-color);
      }
    }
  }
</style>
