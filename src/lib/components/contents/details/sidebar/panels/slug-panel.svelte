<script>
  import { _ } from '@sveltia/i18n';

  import EditableText from '$lib/components/common/editable-text.svelte';
  import SlugEditor from '$lib/components/contents/details/editor/slug-editor.svelte';
  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import PanelSection from '$lib/components/contents/details/sidebar/panels/panel-section.svelte';
  import SlugUpdateForm from '$lib/components/contents/details/sidebar/panels/slug-update-form.svelte';
  import { getSlugOptions } from '$lib/services/contents/collection/slug';
  import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { canUpdateSlug, getSlugPreviews, hasEntrySlug } from '$lib/services/contents/editor/slug';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  const entryDraft = getEntryDraftContext();

  const draft = $derived(entryDraft.current);
  const available = $derived(hasEntrySlug(draft));
  const canUpdate = $derived(canUpdateSlug(draft));
  /* v8 ignore start -- only read while the entry has a slug, which needs the draft */
  const hint = $derived(available && draft ? getSlugOptions(draft.collection).hint : undefined);
  /**
   * Whether each locale has a slug of its own. Otherwise, the slug is shared by every locale, so
   * there’s a single value without a locale heading.
   */
  const localized = $derived(available && !!draft && hasLocalizedSlugs(draft.collection));
  /**
   * Locales whose slug editor is shown in a new entry. A read-only one only shares the default
   * locale’s slug, so it’s left out.
   */
  const editorLocales = $derived(
    Object.entries(draft?.slugEditor ?? {})
      .filter(([locale, enabled]) => enabled === true && !!draft?.currentLocales[locale])
      .map(([locale]) => locale),
  );
  /**
   * Slugs to show read-only, in the enabled locales: the ones a new entry would be saved with if
   * it was saved now, or an existing entry’s current slugs. A locale-agnostic slug is under the `_`
   * key.
   */
  const readonlySlugs = $derived(
    /** @type {[string, string][]} */ (
      Object.entries(draft?.isNew ? getSlugPreviews(draft) : (draft?.currentSlugs ?? {})).filter(
        ([locale, slug]) =>
          slug !== undefined && (locale === '_' || !!draft?.currentLocales[locale]),
      )
    ),
  );
  /* v8 ignore stop */

  /**
   * Get the label of a slug: its locale, which heads the section, or Slug for the only slug shared
   * by every locale, which needs no heading.
   * @param {string} locale Locale, or `_` or `_default` for a slug shared by every locale.
   * @returns {{ label: string, showLabel: boolean }} Label and whether to show it.
   */
  const getSectionLabel = (locale) =>
    localized && !['_', '_default'].includes(locale)
      ? { label: getLocaleLabel(locale) ?? locale, showLabel: true }
      : { label: _('slug'), showLabel: false };
</script>

<PanelContainer title={_('entry_sidebar.slug.title')}>
  {#if !available}
    <div class="empty">{_('entry_sidebar.slug.unavailable')}</div>
  {:else}
    {#if hint}
      <p class="hint">{hint}</p>
    {/if}
    {#if draft?.isNew && editorLocales.length}
      {#each editorLocales as locale (locale)}
        <PanelSection {...getSectionLabel(locale)}>
          {#snippet children(labelId)}
            <div role="none" class="editor">
              <SlugEditor {locale} ariaLabelledby={labelId} />
            </div>
          {/snippet}
        </PanelSection>
      {/each}
    {:else if canUpdate}
      <SlugUpdateForm />
    {:else}
      {#each readonlySlugs as [locale, slug] (locale)}
        <PanelSection {...getSectionLabel(locale)}>
          {#snippet children(labelId)}
            <EditableText
              id="{labelId}-value"
              value={slug}
              canEdit={false}
              ariaLabelledby={labelId}
            />
          {/snippet}
        </PanelSection>
      {/each}
      {#if draft?.isNew}
        <p class="note">{_('entry_sidebar.slug.generated_on_save')}</p>
      {/if}
    {/if}
  {/if}
</PanelContainer>

<style>
  .editor {
    /* The section has padding of its own */
    --field-editor-padding: 0;
  }

  .hint,
  .empty {
    margin: 0;
    padding: 12px 16px;
  }

  .hint {
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  .note {
    margin: 0;
    padding: 0 16px 16px;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
