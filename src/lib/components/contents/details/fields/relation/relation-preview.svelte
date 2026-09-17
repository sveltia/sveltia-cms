<!--
  @component
  Implement the preview for a Relation field.
  @see https://decapcms.org/docs/widgets/#Relation
  @see https://sveltiacms.app/en/docs/fields/relation
-->
<script>
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
  import { getPreviewLabels } from '$lib/services/contents/fields/relation/helpers/preview';
  import { getPendingRefEntries } from '$lib/services/contents/fields/relation/quick-add';
  import { getCanonicalLocale, getDirection, getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { RelationField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const listFormatter = $derived(getListFormatter(locale));
  const refEntries = $derived.by(() => {
    const entries = getRefEntries(fieldConfig);

    // The entries created from the editor are shown by their labels, like the saved ones
    const pendingEntries = getPendingRefEntries({
      draft: entryDraft.current,
      fieldConfig,
      refEntries: entries,
    });

    return pendingEntries.length ? [...entries, ...pendingEntries] : entries;
  });
  const options = $derived(
    getOptions({
      locale,
      fieldConfig,
      refEntries,
      pendingEntries: entryDraft.current?.pendingEntries,
    }),
  );
  const refValues = $derived(getPreviewLabels({ fieldConfig, currentValue, options }));
</script>

{#if refValues.length}
  <p lang={getCanonicalLocale(locale)} dir={getDirection(locale)}>
    {listFormatter.format(refValues)}
  </p>
{/if}
