<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Icon, Option, Select, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
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
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = createRawState(null),
    /* eslint-enable prefer-const */
  } = $props();

  const collection = $derived(entryDraft.current?.collection);
  const collectionFile = $derived(entryDraft.current?.collectionFile);
  const { allLocales } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const listedLocales = $derived(
    env.isSmallScreen || env.isMediumScreen
      ? [...allLocales]
      : allLocales.filter(
          (locale) => !(thatPane.current?.mode === 'edit' && thatPane.current.locale === locale),
        ),
  );
  const hasAnyError = $derived(
    Object.entries(entryDraft.current?.validities ?? {}).some(
      ([locale, validityMap]) =>
        listedLocales.includes(locale) &&
        Object.values(validityMap ?? {}).some(({ valid }) => !valid),
    ),
  );
  const canPreview = $derived(entryDraft.current?.canPreview ?? true);
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
    aria-label={_('switch_locale')}
    aria-controls={id.replace('-header', '-body')}
  >
    <!-- Need an inner to style elements inside the <dialog> -->
    <div role="none" class="inner">
      {#each listedLocales as locale (locale)}
        {@const label = getLocaleLabel(locale) ?? locale}
        {@const disabled = !entryDraft.current?.currentLocales[locale]}
        {@const hasError = Object.values(entryDraft.current?.validities[locale] ?? {}).some(
          ({ valid }) => !valid,
        )}
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
            thisPane.current = { mode: 'edit', locale };

            if (thatPane.current?.mode === 'preview') {
              thatPane.current = { mode: 'preview', locale };
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
      {#if thatPane.current?.mode === 'edit' && canPreview && entryEditorSettings.current?.showPreview}
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
            thisPane.current = { mode: 'preview', locale: thatPane.current?.locale ?? '' };
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
