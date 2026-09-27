<!--
  @component
  Implement the editor for a UUID field.
  @see https://staticjscms.netlify.app/docs/widget-uuid
  @see https://sveltiacms.app/en/docs/fields/uuid
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { warnDeprecation } from '$lib/services/config/deprecations';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getInitialValue } from '$lib/services/contents/fields/uuid/helpers';
  import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { UuidField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {UuidField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = true,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const defaultLocale = $derived(entryDraft.current?.defaultLocale);

  // A new draft has its UUIDs filled in when it’s created, but an existing entry can lack one, e.g.
  // when the field was added after the entry was saved, and so can a newly added list item. Fill
  // in the value once the field is shown in a locale where it’s editable. The editor is reused when
  // the user switches the locale, so do it on every locale change rather than only on mount
  watch(
    () => locale,
    () => {
      if (!currentValue && (locale === defaultLocale || isFieldTranslatable(fieldConfig?.i18n))) {
        currentValue = getInitialValue(fieldConfig);
      }
    },
  );

  onMount(() => {
    // @todo Remove the option prior to the 1.0 release.
    if ('read_only' in fieldConfig) {
      warnDeprecation('uuid_read_only');
    }
  });
</script>

<TextInput
  dir="ltr"
  bind:value={currentValue}
  flex
  readonly={readonly && fieldConfig.read_only !== false}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
