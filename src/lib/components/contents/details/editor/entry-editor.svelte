<script>
  import { VisibilityObserver } from '@sveltia/ui';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import PathEditor from '$lib/components/contents/details/editor/path-editor.svelte';
  import SlugEditor from '$lib/components/contents/details/editor/slug-editor.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived(entryDraft.current?.fields ?? []);
  const showPathEditor = $derived(
    entryDraft.current?.currentPath !== undefined && !entryDraft.current?.isIndexFile,
  );
</script>

<VisibilityObserver>
  {#if !!entryDraft.current?.slugEditor[locale]}
    <SlugEditor {locale} />
  {/if}
  {#if showPathEditor}
    <PathEditor {locale} />
  {/if}
  {#each fields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldEditor
        keyPath={fieldConfig.name}
        typedKeyPath={fieldConfig.name}
        {locale}
        {fieldConfig}
      />
    </VisibilityObserver>
  {/each}
</VisibilityObserver>
