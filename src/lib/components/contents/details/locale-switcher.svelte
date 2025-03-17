<script>
  import { Icon, Option, Select, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';
  import { siteConfig } from '$lib/services/config';
  import { entryDraft } from '$lib/services/contents/draft';
  import { entryEditorSettings } from '$lib/services/contents/draft/editor';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {import('svelte/store').Writable<import('$lib/typedefs').EntryEditorPane | null>
   * } thisPane This pane’s mode and locale.
   * @property {import('svelte/store').Writable<import('$lib/typedefs').EntryEditorPane | null>
   * } [thatPane] Another pane’s mode and locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = writable(null),
    /* eslint-enable prefer-const */
  } = $props();

  const showPreviewPane = $derived($siteConfig?.editor?.preview ?? true);
  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { allLocales } = $derived((collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  const listedLocales = $derived(
    allLocales.filter((locale) => !($thatPane?.mode === 'edit' && $thatPane.locale === locale)),
  );
  const hasAnyError = $derived(
    Object.entries($entryDraft?.validities ?? {}).some(
      ([locale, validityMap]) =>
        listedLocales.includes(locale) &&
        Object.values(validityMap ?? {}).some(({ valid }) => !valid),
    ),
  );
  const canPreview = $derived((collectionFile ?? collection)?.editor?.preview ?? showPreviewPane);
  const useDropDown = $derived(allLocales.length >= 5);
  const SelectComponent = $derived(useDropDown ? Select : SelectButtonGroup);
  const OptionComponent = $derived(useDropDown ? Option : SelectButton);
  const variant = $derived(useDropDown ? undefined : 'tertiary');
  const size = $derived(useDropDown ? undefined : 'small');
</script>

<div class="outer">
  <SelectComponent
    class={hasAnyError ? 'error' : undefined}
    aria-label={$_('switch_locale')}
    aria-controls={id.replace('-header', '-body')}
  >
    <div class="inner">
      {#each listedLocales as locale}
        {@const label = getLocaleLabel(locale)}
        {@const disabled = !$entryDraft?.currentLocales[locale]}
        {@const hasError = Object.values($entryDraft?.validities[locale] ?? {}).some(
          ({ valid }) => !valid,
        )}
        <OptionComponent
          {variant}
          {size}
          {label}
          aria-label="{label} {disabled
            ? $_('locale_content_disabled_short')
            : hasError
              ? $_('locale_content_error_short')
              : ''}"
          selected={$thisPane?.mode === 'edit' && $thisPane.locale === locale}
          class={hasError ? 'error' : ''}
          onSelect={() => {
            $thisPane = { mode: 'edit', locale };

            if ($thatPane?.mode === 'preview') {
              $thatPane = { mode: 'preview', locale };
            }
          }}
        >
          {#snippet startIcon()}
            {#if disabled}
              <Icon name="edit_off" />
            {:else if hasError}
              <Icon name="error" />
            {/if}
          {/snippet}
        </OptionComponent>
      {/each}
      {#if $thatPane?.mode === 'edit' && canPreview && $entryEditorSettings?.showPreview}
        <OptionComponent
          {variant}
          {size}
          label={$_('preview')}
          selected={$thisPane?.mode === 'preview'}
          onSelect={() => {
            $thisPane = { mode: 'preview', locale: $thatPane?.locale ?? '' };
          }}
        />
      {/if}
    </div>
  </SelectComponent>
</div>

<style lang="scss">
  .outer {
    display: contents;

    :global(.combobox.error [role='combobox']) {
      border-color: var(--sui-error-border-color);
    }
  }

  .inner {
    display: contents;

    :global(.error),
    :global(.error button) {
      color: var(--sui-error-foreground-color) !important;
    }
  }
</style>
