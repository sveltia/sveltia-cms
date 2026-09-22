<!--
  @component
  Body of an Object field value or a complex List field item: the editors of its subfields when
  expanded, a summary when collapsed, or a warning when its type isn’t defined.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, TruncatedText, VisibilityObserver } from '@sveltia/ui';

  import Image from '$lib/components/assets/shared/image.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import {
   * FieldContext,
   * InternalLocaleCode,
   * MediaFieldSource,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import { Field, FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} SubFieldProps
   * @property {FieldKeyPath} keyPath Key path of the subfield.
   * @property {TypedFieldKeyPath} typedKeyPath Typed key path of the subfield.
   * @property {FieldContext} [context] Where the subfield is rendered.
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {Field[]} subFields Subfields of the value.
   * @property {(subField: Field) => SubFieldProps} getSubFieldProps Function returning the key
   * paths and context of a subfield.
   * @property {boolean} expanded Whether the subfields are shown.
   * @property {boolean} unknownType Whether the value has a type the field doesn’t define, in which
   * case nothing can be edited.
   * @property {() => string} getSummary Function returning the summary shown while collapsed.
   * @property {() => MediaFieldSource | undefined} getThumbnail Function returning the thumbnail
   * shown along with the summary.
   * @property {string} [summaryId] `id` of the summary, so the value can be labelled by it.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    subFields,
    getSubFieldProps,
    expanded,
    unknownType,
    getSummary,
    getThumbnail,
    summaryId = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if unknownType}
  <Alert status="warning">{_('unknown_variable_type')}</Alert>
{:else if expanded}
  {#each subFields as subField (subField.name)}
    <VisibilityObserver>
      <FieldEditor {...getSubFieldProps(subField)} {locale} fieldConfig={subField} />
    </VisibilityObserver>
  {/each}
{:else}
  <!-- The summary is only worked out while it’s shown -->
  {@const summary = getSummary()}
  {@const thumbnail = getThumbnail()}
  {#if summary || thumbnail}
    <div role="none" class="summary" id={summaryId}>
      {#if thumbnail}
        <Image asset={thumbnail.asset} src={thumbnail.url} variant="icon" cover />
      {/if}
      <TruncatedText lines={env.isSmallScreen ? 2 : 1}>
        {summary}
      </TruncatedText>
    </div>
  {/if}
{/if}

<style>
  .summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
  }
</style>
