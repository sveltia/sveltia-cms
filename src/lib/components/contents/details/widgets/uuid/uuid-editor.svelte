<!--
  @component
  Implement the editor for the UUID widget.
  @see https://decapcms.org/docs/widgets/#uuid
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';
  import { getDefaultValue } from '$lib/services/contents/widgets/uuid/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {UuidField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);

  // Generate the default value here instead of in `create.js` because `getDefaultValues()` doesn’t
  // i18n-duplicate the value
  onMount(() => {
    if (!currentValue) {
      if (locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n ?? false)) {
        currentValue = getDefaultValue(fieldConfig);
      }
    }
  });
</script>

<TextInput
  bind:value={currentValue}
  flex
  readonly={readonly || fieldConfig.read_only !== false}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
