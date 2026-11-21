<!--
  @component
  Show that a locale is disabled on the entry draft, with a button to enable it, in place of the
  locale’s fields. Used by the entry editor’s pane and the Relation field’s quick-add dialog, so a
  disabled locale can’t be edited without enabling it first.
  @see https://github.com/sveltia/sveltia-cms/issues/1176
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { isDraftLocked } from '$lib/services/workflow';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Disabled locale.
   */

  /** @type {Props} */
  let { locale } = $props();

  const entryDraft = getEntryDraftContext();

  const hasContent = $derived(!!entryDraft.current?.currentValues[locale]);
  // A locked entry is shown for reference only, so its locales can’t be enabled
  const locked = $derived(isDraftLocked(entryDraft.current));
  /* v8 ignore start -- a locale configured for the site always has a label */
  const labelOptions = $derived({ values: { locale: getLocaleLabel(locale) ?? locale } });
  /* v8 ignore stop */
</script>

<EmptyState>
  <span role="alert">
    {_(hasContent ? 'locale_x_now_disabled' : 'locale_x_has_been_disabled', labelOptions)}
  </span>
  {#if !locked}
    <Button
      variant="tertiary"
      label={_(hasContent ? 'reenable_x_locale' : 'enable_x_locale', labelOptions)}
      onclick={() => {
        /* v8 ignore next 3 -- the draft is there while the component is rendered */
        if (entryDraft.current) {
          toggleLocale({ draft: entryDraft.current, locale });
        }
      }}
    />
  {/if}
</EmptyState>
