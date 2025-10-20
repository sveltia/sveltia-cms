<!--
  @component
  Implement the editor for the Code widget.
  @see https://decapcms.org/docs/widgets/#Code
-->
<script>
  import { CodeEditor } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { getContext, untrack } from 'svelte';

  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { FieldEditorContext, WidgetEditorProps } from '$lib/types/private';
   * @import { CodeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CodeField} fieldConfig Field configuration.
   * @property {string | Record<string, string> | undefined} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let code = $state('');
  let lang = $state('');

  const {
    default_language: defaultLanguage = '',
    allow_language_selection: showLanguageSwitcher = true,
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = $derived(fieldConfig);
  const valueMap = $derived($state.snapshot($entryDraft?.[valueStoreKey][locale]) ?? {});
  const codeKeyPath = $derived(`${keyPath}.${outputKeys.code}`);
  const langKeyPath = $derived(`${keyPath}.${outputKeys.lang}`);

  /**
   * Update {@link code} and {@link lang} based on {@link currentValue}.
   */
  const setInputValue = () => {
    if (outputCodeOnly) {
      if (typeof currentValue !== 'string') {
        code = '';
      } else if (code !== currentValue) {
        code = currentValue;
      }
    } else {
      const _code = valueMap[codeKeyPath];
      const _lang = valueMap[langKeyPath] || defaultLanguage;

      if (typeof _code !== 'string') {
        code = '';
      } else if (code !== _code) {
        code = _code;
      }

      if (typeof _lang !== 'string') {
        lang = '';
      } else if (lang !== _lang) {
        lang = _lang;
      }
    }
  };

  /**
   * Update {@link currentValue} based on {@link code} and {@link lang}.
   */
  const setCurrentValue = () => {
    if (outputCodeOnly) {
      if (currentValue !== code) {
        currentValue = code;
      }
    } else if ($entryDraft) {
      currentValue = {};

      if (valueMap[codeKeyPath] !== code) {
        $entryDraft[valueStoreKey][locale][codeKeyPath] = code;
      }

      if (valueMap[langKeyPath] !== lang) {
        $entryDraft[valueStoreKey][locale][langKeyPath] = lang;
      }
    }
  };

  $effect(() => {
    void [valueMap];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void [code, lang];

    untrack(() => {
      setCurrentValue();
    });
  });
</script>

{#await sleep() then}
  <!--
    Reset the editor when the configuration changes. It happens when fields are reordered or removed
    in a variable type list field. @see https://github.com/sveltia/sveltia-cms/issues/480
  -->
  {#key JSON.stringify(fieldConfig)}
    <CodeEditor
      bind:code
      bind:lang
      {showLanguageSwitcher}
      flex
      {readonly}
      {required}
      {invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
    />
  {/key}
{/await}
