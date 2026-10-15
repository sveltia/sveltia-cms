<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Icon, Option, Select, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { hasInvalidFields } from '$lib/services/contents/draft/validate/reveal';
  import { afterPendingFieldUpdates } from '$lib/services/contents/editor/pending';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
  import { env } from '$lib/services/user/env.svelte';
  import { createRawState } from '$lib/services/utils/state.svelte';

  /**
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {{ current: ?EntryEditorPane }} thisPane This pane’s mode and locale.
   * @property {{ current: ?EntryEditorPane }} [thatPane] Another pane’s mode and locale.
   * @property {boolean} [previewInThisPane] Whether to offer the preview in this pane, which takes
   * turns with the editor when there’s no other pane to hold it.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = createRawState(null),
    previewInThisPane = false,
    /* eslint-enable prefer-const */
  } = $props();

  const { i18nEnabled, allLocales } = $derived(getDraftI18nConfig(entryDraft.current));
  // With a single locale, the only option is the editor, which takes turns with the preview
  const hasMultipleLocales = $derived(i18nEnabled && allLocales.length > 1);
  /* v8 ignore start -- the switcher is only rendered while the draft is there */
  const validities = $derived(entryDraft.current?.validities ?? {});
  const canPreview = $derived(entryDraft.current?.canPreview ?? true);
  /* v8 ignore stop */
  const listedLocales = $derived(
    env.isSmallScreen || env.isMediumScreen
      ? [...allLocales]
      : allLocales.filter(
          (locale) => !(thatPane.current?.mode === 'edit' && thatPane.current.locale === locale),
        ),
  );
  // The preview can take this pane’s place when the other pane edits a locale
  const previewOffered = $derived(
    previewInThisPane ||
      (thatPane.current?.mode === 'edit' &&
        canPreview &&
        !!entryEditorSettings.current?.showPreview),
  );
  const hasAnyError = $derived(
    Object.entries(validities).some(
      ([locale, validityMap]) => listedLocales.includes(locale) && hasInvalidFields(validityMap),
    ),
  );
  const useDropDown = $derived(env.isSmallScreen || env.isMediumScreen || allLocales.length >= 5);
  const SelectComponent = $derived(useDropDown ? Select : SelectButtonGroup);
  const OptionComponent = $derived(useDropDown ? Option : SelectButton);
  const variant = $derived(useDropDown ? undefined : 'tertiary');
  const size = $derived(useDropDown ? undefined : 'small');
  const currentValue = $derived(
    thisPane.current?.mode === 'edit'
      ? thisPane.current.locale
      : thisPane.current?.mode === 'preview'
        ? 'preview'
        : undefined,
  );
</script>

<div role="none" class="wrapper">
  <SelectComponent
    value={currentValue}
    class={hasAnyError && useDropDown ? 'error' : undefined}
    ariaLabel={_(hasMultipleLocales ? 'switch_locale' : 'switch_view')}
    aria-controls={id.replace('-header', '-body')}
  >
    <!-- Need an inner to style elements inside the <dialog> -->
    <div role="none" class="inner">
      {#each listedLocales as locale (locale)}
        {@const label = hasMultipleLocales ? (getLocaleLabel(locale) ?? locale) : _('edit')}
        {@const disabled = !entryDraft.current?.currentLocales[locale]}
        <!-- A locale without content, e.g. a disabled one, is left out of the validation -->
        {@const hasError = hasInvalidFields(validities[locale])}
        <OptionComponent
          {variant}
          {size}
          {label}
          value={locale}
          aria-label="{label} {disabled
            ? _('locale_content_disabled_short')
            : hasError
              ? _('locale_content_error_short')
              : ''}"
          selected={thisPane.current?.mode === 'edit' && thisPane.current.locale === locale}
          class={hasError ? 'error' : ''}
          data-mode="edit"
          onSelect={() => {
            afterPendingFieldUpdates(() => {
              thisPane.current = { mode: 'edit', locale };

              if (thatPane.current?.mode === 'preview') {
                thatPane.current = { mode: 'preview', locale };
              }
            });
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
      {#if previewOffered}
        {#if useDropDown}
          <Divider />
        {/if}
        <OptionComponent
          {variant}
          {size}
          label={_('preview')}
          value="preview"
          selected={thisPane.current?.mode === 'preview'}
          data-mode="preview"
          onSelect={() => {
            // Read the locale now: the other pane may change while the updates land. Without one,
            // this pane previews the locale it edits
            const { locale } = /** @type {EntryEditorPane} */ (
              thatPane.current ?? thisPane.current
            );

            afterPendingFieldUpdates(() => {
              thisPane.current = { mode: 'preview', locale };
            });
          }}
        />
      {/if}
    </div>
  </SelectComponent>
</div>

<style>
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
