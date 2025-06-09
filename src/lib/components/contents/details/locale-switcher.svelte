<script>
  import { Icon, Option, Select, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { writable } from 'svelte/store';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { entryEditorSettings } from '$lib/services/contents/draft/editor';
  import { DEFAULT_I18N_CONFIG, getLocaleLabel } from '$lib/services/contents/i18n';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {Writable<?EntryEditorPane>} thisPane This pane’s mode and locale.
   * @property {Writable<?EntryEditorPane>} [thatPane] Another pane’s mode and locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = writable(null),
    /* eslint-enable prefer-const */
  } = $props();

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { allLocales } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const listedLocales = $derived(
    $isSmallScreen || $isMediumScreen
      ? [...allLocales]
      : allLocales.filter((locale) => !($thatPane?.mode === 'edit' && $thatPane.locale === locale)),
  );
  const hasAnyError = $derived(
    Object.entries($entryDraft?.validities ?? {}).some(
      ([locale, validityMap]) =>
        listedLocales.includes(locale) &&
        Object.values(validityMap ?? {}).some(({ valid }) => !valid),
    ),
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const useDropDown = $derived($isSmallScreen || $isMediumScreen || allLocales.length >= 5);
  const SelectComponent = $derived(useDropDown ? Select : SelectButtonGroup);
  const OptionComponent = $derived(useDropDown ? Option : SelectButton);
  const variant = $derived(useDropDown ? undefined : 'tertiary');
  const size = $derived(useDropDown ? undefined : 'small');
</script>

<div role="none" class="wrapper">
  <SelectComponent
    class={hasAnyError && useDropDown ? 'error' : undefined}
    aria-label={$_('switch_locale')}
    aria-controls={id.replace('-header', '-body')}
  >
    <!-- Need an inner to style elements inside the <dialog> -->
    <div role="none" class="inner">
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
          data-mode="edit"
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
          data-mode="preview"
          onSelect={() => {
            $thisPane = { mode: 'preview', locale: $thatPane?.locale ?? '' };
          }}
        />
      {/if}
    </div>
  </SelectComponent>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global {
      .combobox {
        @media (width < 1024px) {
          min-width: 128px;
          --sui-textbox-height: 32px;
          --sui-button-medium-height: 32px;
        }

        &.error [role='combobox'] {
          border-color: var(--sui-error-border-color);
        }
      }
    }
  }

  .inner {
    display: contents;

    :global {
      :is(.error, .error button[data-mode='edit']) {
        color: var(--sui-error-foreground-color) !important;
      }
    }
  }
</style>
