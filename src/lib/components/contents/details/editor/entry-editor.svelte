<script>
  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived($entryDraft?.fields ?? []);
</script>

<VisibilityObserver>
  {#each fields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldEditor keyPath={fieldConfig.name} {locale} {fieldConfig} />
    </VisibilityObserver>
  {/each}
</VisibilityObserver>
