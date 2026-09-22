<!--
  @component
  Implement the preview for an Object field.
  @see https://decapcms.org/docs/widgets/#Object
  @see https://sveltiacms.app/en/docs/fields/object
-->
<script>
  import { VisibilityObserver } from '@sveltia/ui';

  import Subsection from '$lib/components/contents/details/fields/object/subsection.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import {
   * ObjectField,
   * ObjectFieldWithSubFields,
   * ObjectFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const { fields } = $derived(/** @type {ObjectFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ObjectFieldWithTypes} */ (fieldConfig));
  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale));
  // Ask the shared key path index rather than scanning the whole value map; see the same check in
  // the Object field editor
  const hasValues = $derived(
    getKeysByPrefix(valueMap, `${keyPath}.`).some((_keyPath) => !!valueMap[_keyPath]),
  );
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const type = $derived(hasVariableTypes ? valueMap[typeKeyPath] : undefined);
  const typeConfig = $derived(type ? types?.find(({ name }) => name === type) : undefined);
  const label = $derived(typeConfig ? typeConfig.label || typeConfig.name : undefined);
  /* v8 ignore start -- only read for a known type, which has its subfields */
  const subFields = $derived((hasVariableTypes ? typeConfig?.fields : fields) ?? []);
  /* v8 ignore stop */
</script>

{#if hasValues}
  {#if hasVariableTypes && !typeConfig}
    <!-- Unknown type: a warning is displayed in the editor -->
  {:else}
    <Subsection {label}>
      {#each subFields as subField (subField.name)}
        {@const subFieldKeyPath = `${keyPath}.${subField.name}`}
        <VisibilityObserver>
          <FieldPreview
            keyPath={subFieldKeyPath}
            typedKeyPath={hasVariableTypes && typeConfig?.name
              ? `${typedKeyPath}<${typeConfig.name}>.${subField.name}`
              : subFieldKeyPath}
            {locale}
            fieldConfig={subField}
          />
        </VisibilityObserver>
      {/each}
    </Subsection>
  {/if}
{/if}
