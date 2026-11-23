<!--
  @component
  Previews of the subfields of an Object field value or a complex List field item, grouped under the
  label of its variable type, if any. Nothing is rendered for a type the field doesn’t define: a
  warning is displayed in the editor.
-->
<script>
  import { VisibilityObserver } from '@sveltia/ui';

  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import {
    getTypedSubKeyPath,
    resolveVariableType,
  } from '$lib/services/contents/fields/object/helpers';
  import { getFieldLabel } from '$lib/services/contents/i18n/options';

  /**
   * @import { InternalLocaleCode, TypedFieldKeyPath } from '$lib/types/private';
   * @import { Field, FieldKeyPath, VariableFieldType } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Key path of the value.
   * @property {TypedFieldKeyPath} typedKeyPath Typed key path of the value, e.g. `sections.*`.
   * @property {VariableFieldType[]} [types] Types the field defines. `undefined` if the field
   * doesn’t have variable types.
   * @property {Field[]} [fields] Subfields of a field without variable types.
   * @property {string} [type] Type the value has, if any.
   * @property {boolean} [single] Whether the value is a List field item holding its single subfield
   * as the item itself, so the subfield has the item’s key path.
   */

  /** @type {Props} */
  let { locale, keyPath, typedKeyPath, types, fields, type, single = false } = $props();

  const sectionId = $props.id();
  const headerId = `${sectionId}-header`;

  const { typeConfig, unknownType, subFields } = $derived(
    resolveVariableType({ types, fields, type }),
  );
  const label = $derived(typeConfig ? getFieldLabel({ config: typeConfig, locale }) : undefined);
</script>

{#if !unknownType}
  <div role="group" class="subsection" aria-labelledby={label ? headerId : undefined}>
    {#if label}
      <div role="none" id={headerId} class="header">
        {label}
      </div>
    {/if}
    <div role="none" class="items">
      {#each subFields as subField (subField.name)}
        {@const subFieldKeyPath = single ? keyPath : `${keyPath}.${subField.name}`}
        <!-- Mark the subfield outside its observer, so that focusing it can scroll the preview to
          it even before it’s rendered -->
        <div role="none" data-lazy-key-path={subFieldKeyPath}>
          <VisibilityObserver>
            <FieldPreview
              keyPath={subFieldKeyPath}
              typedKeyPath={getTypedSubKeyPath({
                typedKeyPath,
                type: typeConfig?.name,
                subFieldName: subField.name,
              })}
              {locale}
              fieldConfig={subField}
            />
          </VisibilityObserver>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .subsection {
    margin: 16px auto;
    border: 2px solid var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    :global(.title) {
      font-size: inherit;
      font-weight: var(--sui-font-weight-normal);
    }
  }

  .header {
    display: flex;
    align-items: center;
    height: 24px;
    padding-inline: 8px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-secondary-border-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-bold);
  }

  .items {
    padding: 8px 16px;

    /* Hide when no subfield is shown, leaving only the empty wrappers marking the subfields */
    &:not(:has(> :not(:empty))) {
      display: none;
    }
  }
</style>
