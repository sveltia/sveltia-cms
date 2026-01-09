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
  import { entryDraft } from '$lib/services/contents/draft';
  import { getInitialValue } from '$lib/services/contents/fields/uuid/helper';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { UuidField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {UuidField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

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

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);

  // Generate the default value here instead of in `create.js` because `getDefaultValues()` doesn’t
  // i18n-duplicate the value
  onMount(() => {
    if (!currentValue) {
      if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
        currentValue = getInitialValue(fieldConfig);
      }
    }

    // @todo Remove the option prior to the 1.0 release.
    if ('read_only' in fieldConfig) {
      warnDeprecation('uuid_read_only');
    }
  });
</script>

<TextInput
  bind:value={currentValue}
  flex
  readonly={readonly && fieldConfig.read_only !== false}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
