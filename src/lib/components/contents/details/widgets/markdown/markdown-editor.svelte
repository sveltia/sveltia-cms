<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import {
    buttonNameMap,
    defaultButtons,
    defaultComponents,
    defaultModes,
    modeNameMap,
    registeredComponents,
  } from '$lib/services/contents/widgets/markdown';
  import {
    EditorComponent,
    getComponentDef,
  } from '$lib/services/contents/widgets/markdown/component';

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
   * @type {MarkdownField}
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

  const allComponents = [...defaultComponents, ...registeredComponents.map((c) => c.id)];

  $: ({
    // Widget-specific options
    modes = [...defaultModes],
    buttons = [...defaultButtons],
    editor_components: editorComponents = [...allComponents],
    minimal = false,
  } = fieldConfig);

  /**
   * @type {string}
   */
  let inputValue = '';

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   * @param {string} newValue - New value to be set.
   */
  const setInputValue = (newValue) => {
    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} while avoiding a cycle dependency.
   * @param {string} newValue - New value to be set.
   */
  const setCurrentValue = (newValue) => {
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: setInputValue(typeof currentValue === 'string' ? currentValue : '');
  $: setCurrentValue(inputValue ?? '');

  $: components = editorComponents
    .map((name) => {
      const componentDef = registeredComponents.find((c) => c.id === name) ?? getComponentDef(name);

      if (componentDef) {
        return /** @type {import('@sveltia/ui').TextEditorComponent} */ (
          new EditorComponent(componentDef)
        );
      }

      return undefined;
    })
    .filter((component) => !!component);
</script>

<div role="none" class="wrapper" class:minimal>
  {#await sleep(0) then}
    <TextEditor
      lang={locale}
      modes={modes.map((name) => modeNameMap[name]).filter(Boolean)}
      buttons={buttons.map((name) => buttonNameMap[name]).filter(Boolean)}
      {components}
      bind:value={inputValue}
      flex
      {readonly}
      {required}
      {invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      autoResize={true}
    />
  {/await}
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    &.minimal {
      :global([role='textbox']),
      :global(textarea) {
        overflow: auto;
        max-height: 240px;
      }
    }
  }
</style>
