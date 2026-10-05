<!--
  @component
  Implement the editor for a Code field.
  @see https://decapcms.org/docs/widgets/#Code
  @see https://sveltiacms.app/en/docs/fields/code
-->
<script>
  import { CodeEditor } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { isObject } from '@sveltia/utils/object';
  import { getContext, tick } from 'svelte';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { trackPendingFieldUpdate } from '$lib/services/contents/editor/pending';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { CodeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CodeField} fieldConfig Field configuration.
   * @property {string | Record<string, string> | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
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
  let pending = $state(false);

  const {
    default_language: defaultLanguage = 'plain',
    allow_language_selection: showLanguageSwitcher = true,
    output_code_only: outputCodeOnly = false,
    keys: outputKeys = { code: 'code', lang: 'lang' },
  } = $derived(fieldConfig);
  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale, valueStoreKey));
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

      lang = defaultLanguage;
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

      return;
    }

    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    /** @type {Record<string, any>} */
    const updates = {};

    if (!isObject(valueMap[keyPath]) || Object.keys(valueMap[keyPath]).length) {
      updates[keyPath] = {};
    }

    if (valueMap[codeKeyPath] !== code) {
      updates[codeKeyPath] = code;
    }

    if (valueMap[langKeyPath] !== lang) {
      updates[langKeyPath] = lang;
    }

    if (!Object.keys(updates).length) {
      return;
    }

    const valueStore = draft[valueStoreKey][locale];

    // This runs from an effect, so defer the write to the draft like `<FieldEditor>` does: a write
    // made while an effect is running makes Svelte walk the derived graph below the value map
    // without memoizing, which takes exponentially longer with each level of nesting
    queueMicrotask(() => {
      Object.assign(valueStore, updates);
    });
  };

  watch(
    () => valueMap,
    () => {
      setInputValue();
    },
  );

  watch(
    () => [code, lang],
    () => {
      setCurrentValue();
    },
  );

  // While the editor holds a change made by the user, register it as a pending update: the editor
  // passes the code on with a short delay, so a save right after a change would otherwise validate
  // and write the previous value
  $effect(() => {
    if (!pending) {
      return undefined;
    }

    /** @type {PromiseWithResolvers<void>} */
    const { promise, resolve } = Promise.withResolvers();

    trackPendingFieldUpdate(promise);

    // Settle once the value has reached the draft, which `setCurrentValue()` writes in a microtask,
    // or when the editor goes away
    return async () => {
      await tick();
      resolve();
    };
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
      bind:pending
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
