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
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import { backend } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { entryDraft } from '$lib/services/contents/draft';
  import { entryEditorSettings } from '$lib/services/contents/draft/editor';
  import { revertChanges, toggleLocale } from '$lib/services/contents/draft/update';
  import { getEntryPreviewURL, getEntryRepoBlobURL } from '$lib/services/contents/entry';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {string} id - The wrapper element’s `id` attribute.
   * @property {import('svelte/store').Writable<?EntryEditorPane>} thisPane - This pane’s mode and
   * locale.
   * @property {import('svelte/store').Writable<?EntryEditorPane>} [thatPane] - Another pane’s mode
   * and locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = writable(null),
    /* eslint-enable prefer-const */
  } = $props();

  const { editor: { preview: showPreviewPane = true } = {} } = $derived(
    $siteConfig ?? /** @type {SiteConfig} */ ({}),
  );
  const {
    collection,
    collectionFile,
    originalEntry,
    originalValues = {},
  } = $derived($entryDraft ?? /** @type {EntryDraft} */ ({}));
  const { i18nEnabled, saveAllLocales, locales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig,
  );
  const isLocaleEnabled = $derived($entryDraft?.currentLocales[$thisPane?.locale ?? '']);
  const isOnlyLocale = $derived(
    Object.values($entryDraft?.currentLocales ?? {}).filter((enabled) => enabled).length === 1,
  );
  const otherLocales = $derived(i18nEnabled ? locales.filter((l) => l !== $thisPane?.locale) : []);
  const canPreview = $derived((collectionFile ?? collection)?.editor?.preview ?? showPreviewPane);
  const canCopy = $derived(!!otherLocales.length);
  const canRevert = $derived(
    $thisPane?.locale &&
      !equal(
        $state.snapshot($entryDraft?.currentValues[$thisPane?.locale]),
        originalValues[$thisPane?.locale],
      ),
  );
  const previewURL = $derived(
    originalEntry && $thisPane?.locale
      ? getEntryPreviewURL(originalEntry, $thisPane?.locale, collection, collectionFile)
      : undefined,
  );
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
          {@const invalid = Object.values($entryDraft?.validities[locale] ?? {}).some(
            ({ valid }) => !valid,
          )}
          {#if !($thatPane?.mode === 'edit' && $thatPane?.locale === locale)}
            <SelectButton
              selected={$thisPane?.mode === 'edit' && $thisPane?.locale === locale}
              variant="tertiary"
              size="small"
              class={invalid ? 'error' : ''}
              label={localeLabel}
              onSelect={() => {
                $thisPane = { mode: 'edit', locale };

                if ($thatPane?.mode === 'preview') {
                  $thatPane = { mode: 'preview', locale };
                }
              }}
            >
              {#snippet endIcon()}
                {#if invalid}
                  <Icon name="error" aria-label={$_('locale_content_errors')} />
                {/if}
              {/snippet}
            </SelectButton>
          {/if}
        {/each}
        {#if $thatPane?.mode === 'edit' && canPreview && $entryEditorSettings?.showPreview}
          <SelectButton
            selected={$thisPane?.mode === 'preview'}
            variant="tertiary"
            size="small"
            label={$_('preview')}
            onSelect={() => {
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
      {#if canCopy}
        <TranslateButton locale={$thisPane?.locale} {otherLocales} />
      {/if}
      <MenuButton
        variant="ghost"
        iconic
        popupPosition="bottom-right"
        aria-label={$_('show_content_options_x_locale', { values: { locale: localeLabel } })}
      >
        {#snippet popup()}
          <Menu aria-label={$_('content_options_x_locale', { values: { locale: localeLabel } })}>
            {#if canCopy && $thisPane?.locale}
              <CopyMenuItems locale={$thisPane.locale} {otherLocales} />
            {/if}
            <MenuItem
              label={$_('revert_changes')}
              disabled={!canRevert}
              onclick={() => {
                revertChanges($thisPane?.locale);
              }}
            />
            {#if !saveAllLocales && $thisPane?.locale}
              <Divider />
              <MenuItem
                label={$_(
                  isLocaleEnabled
                    ? 'disable_x_locale'
                    : $state.snapshot($entryDraft?.currentValues[$thisPane.locale])
                      ? 'reenable_x_locale'
                      : 'enable_x_locale',
                  { values: { locale: localeLabel } },
                )}
                disabled={$thisPane.locale === defaultLocale || (isLocaleEnabled && isOnlyLocale)}
                onclick={() => {
                  toggleLocale($thisPane?.locale ?? '');
                }}
              />
            {/if}
            {#if originalEntry && (previewURL || $prefs.devModeEnabled)}
              <Divider />
              {#if previewURL}
                <MenuItem
                  label={$_('view_on_live_site')}
                  onclick={() => {
                    window.open(previewURL);
                  }}
                />
              {/if}
              {#if $prefs.devModeEnabled}
                <MenuItem
                  disabled={!$backend?.repository?.blobBaseURL}
                  label={$_('view_on_x', {
                    values: { service: $backend?.repository?.label },
                    default: $_('view_in_repository'),
                  })}
                  onclick={() => {
                    if (originalEntry && $thisPane) {
                      window.open(getEntryRepoBlobURL(originalEntry, $thisPane.locale));
                    }
                  }}
                />
              {/if}
            {/if}
          </Menu>
        {/snippet}
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
