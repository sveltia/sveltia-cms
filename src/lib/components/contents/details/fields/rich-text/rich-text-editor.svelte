<!--
  @component
  Implement the editor for a Markdown/RichText field.
  @see https://decapcms.org/docs/widgets/#Markdown
  @see https://sveltiacms.app/en/docs/fields/richtext
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import {
    $createParagraphNode as createParagraphNode,
    getNearestEditorFromDOMNode,
    $insertNodes as insertNodes,
  } from 'lexical';
  import { getContext, tick } from 'svelte';

  import { EditorComponent } from '$lib/components/contents/details/fields/rich-text/custom-node-features';
  import { customComponentRegistry } from '$lib/services/api/registries';
  import { cmsConfig } from '$lib/services/config';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { trackPendingFieldUpdate } from '$lib/services/contents/editor/pending';
  import { getField } from '$lib/services/contents/entry/fields';
  import {
    getAssetLibraryFolderMap,
    getDefaultAssetFolder,
  } from '$lib/services/contents/fields/file/helpers';
  import { processResource } from '$lib/services/contents/fields/file/process';
  import {
    BUILTIN_COMPONENTS,
    BUTTON_NAME_MAP,
    COMPONENT_NAME_PREFIX_REGEX,
    DEFAULT_BUTTONS,
    DEFAULT_MODES,
    getValueFormat,
    NODE_NAME_MAP,
  } from '$lib/services/contents/fields/rich-text';
  import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
  import { supportsHTML } from '$lib/services/contents/fields/rich-text/components/utils';
  import {
    getDroppedImages,
    getPastedImages,
  } from '$lib/services/contents/fields/rich-text/images';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { syncValues, watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { ImageEntry } from '$lib/services/contents/fields/rich-text/images';
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import {
   * EditorComponentDefinition,
   * ImageField,
   * MarkdownField,
   * RichTextField,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  const defaultConfig = cmsConfig.current?.field_defaults?.richtext ?? {};
  /* v8 ignore start -- the editor is always rendered within a field editor */
  /** @type {FieldEditorContext} */
  const { fieldContext, parentComponentNames, valueStoreKey } = getContext('field-editor') ?? {};
  /* v8 ignore stop */
  const inEditorComponent = fieldContext === 'rich-text-editor-component';
  const componentName = parentComponentNames.at(-1);

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  let inputValue = $state('');

  let cleanupTimeout = 0;
  /**
   * Whether the editor has yet to write a change made by the user back to {@link inputValue}.
   */
  let pending = $state(false);

  const {
    // Field type-specific options
    modes: _modes = defaultConfig.modes ?? [...DEFAULT_MODES],
    buttons: _buttons = defaultConfig.buttons ?? [...DEFAULT_BUTTONS],
    editor_components: _editorComponents = defaultConfig.editor_components ??
      // Include all built-in and custom components by default
      [...BUILTIN_COMPONENTS, ...customComponentRegistry.keys()],
    allow_nested_components: _allowNestedComponents,
    linked_images: linkedImagesEnabled = defaultConfig.linked_images ?? true,
    use_emoji_autocomplete: useEmojiAutocomplete = defaultConfig.use_emoji_autocomplete ?? true,
    use_markdown_shortcuts: useMarkdownShortcuts = defaultConfig.use_markdown_shortcuts ?? true,
    minimal = defaultConfig.minimal ?? false,
  } = $derived(fieldConfig);
  const format = $derived(getValueFormat(fieldConfig));
  const modes = $derived(_modes.map((name) => NODE_NAME_MAP[name]).filter(Boolean));
  /* v8 ignore start -- the editor is only rendered while the draft is there */
  const isIndexFile = $derived(entryDraft.current?.isIndexFile ?? false);
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);
  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale, valueStoreKey));
  const buttons = $derived(
    [
      ..._buttons,
      // Include `code-block` implemented as a block type
      ...(_editorComponents.includes('code-block') ? ['code-block'] : []),
    ]
      // @ts-ignore
      .map((name) => BUTTON_NAME_MAP[name])
      .filter(Boolean),
  );
  const allowNestedComponents = $derived.by(() => {
    let nested = _allowNestedComponents;

    if (inEditorComponent) {
      // Retrieve the parent Markdown or RichText field config
      nested = /** @type {MarkdownField | RichTextField} */ (
        getField({
          collectionName,
          fileName,
          isIndexFile,
          valueMap,
          // Extract the parent field name, e.g. `body:c55:content` -> `body`
          keyPath: /** @type {string} */ (keyPath.match(/^[^:]+/)?.[0]),
        })
      )?.allow_nested_components;
    }

    return nested ?? defaultConfig.allow_nested_components ?? true;
  });
  const components = $derived.by(() => {
    if (inEditorComponent && !allowNestedComponents) {
      return [];
    }

    return (
      _editorComponents
        .map((name) =>
          getComponentDef(name === 'image' && linkedImagesEnabled ? 'linked-image' : name),
        )
        .filter((def) => !!def)
        // Only the components with HTML syntax can be used in HTML
        .filter((def) => format !== 'html' || supportsHTML(def))
        // Compare the definition IDs, because the parent component names are the IDs, which are
        // prefixed for custom components, e.g. `x-youtube`
        .filter(
          (def) =>
            allowNestedComponents !== 'exclude_self' || !parentComponentNames.includes(def.id),
        )
        .map(
          (def) =>
            /** @type {import('@sveltia/ui').TextEditorComponent} */ (new EditorComponent(def)),
        )
    );
  });
  const imageComponent = $derived(
    components.find(({ id }) => id === 'image' || id === 'linked-image'),
  );
  const targetAssetFolder = $derived(
    getDefaultAssetFolder(
      getAssetLibraryFolderMap({
        collectionName,
        fileName,
        componentName,
        typedKeyPath,
        isIndexFile,
      }),
    ),
  );

  /**
   * Insert images to the editor content.
   * @param {object} args Arguments.
   * @param {EventTarget | null} args.target Event target.
   * @param {ImageEntry[]} args.images Image list.
   */
  const insertImages = async ({ target, images }) => {
    const outer = /** @type {HTMLElement} */ (target)?.closest('div');
    const editor = getNearestEditorFromDOMNode(outer);

    if (!entryDraft.current || !imageComponent || !outer?.matches('.lexical-root') || !editor) {
      return;
    }

    const srcFieldConfig =
      /** @type {import('@sveltia/ui').TextEditorComponent & EditorComponentDefinition} */ (
        imageComponent
      ).fields?.find(({ name }) => name === 'src');

    const { config: libraryConfig } = getDefaultMediaLibraryOptions({
      fieldConfig: /** @type {ImageField} */ (srcFieldConfig),
    });

    const draft = entryDraft.current;
    const folder = targetAssetFolder;

    // eslint-disable-next-line no-restricted-syntax
    for (const { file, src: externalSrc, alt = '' } of images) {
      let src = externalSrc;

      if (file) {
        // eslint-disable-next-line no-await-in-loop
        const { value } = await processResource({
          draft,
          resource: { file, folder },
          libraryConfig,
        });

        src = value;
      }

      if (!src) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const _src = src;

      editor.update(() => {
        insertNodes([imageComponent.createNode({ src: _src, alt }), createParagraphNode()]);
      });
    }
  };

  /**
   * Handle pasted content. If it includes images, insert them to the editor content.
   * @param {ClipboardEvent} event `paste` event.
   */
  const onPaste = async (event) => {
    const { target } = event;
    const images = await getPastedImages(event);

    if (images.length) {
      await insertImages({ target, images });
    }
  };

  /**
   * Handle dropped content. If it includes images, insert them to the editor content.
   * @param {DragEvent} event `drop` event.
   */
  const onDrop = async (event) => {
    const { target } = event;
    const images = await getDroppedImages(event);

    if (images.length) {
      await insertImages({ target, images });
    }
  };

  /**
   * Remove the extra values of the components that are no longer present in the editor, shortly
   * after {@link currentValue} has changed.
   */
  const scheduleExtraValueCleanup = () => {
    // Skip cleanup when used as a nested component editor
    const draft = entryDraft.current;

    if (!draft || inEditorComponent) {
      return;
    }

    window.clearTimeout(cleanupTimeout);

    // Remove values that are not present in the editor anymore. Otherwise, they will trigger
    // validation errors when the entry is saved.
    cleanupTimeout = window.setTimeout(() => {
      Object.keys(draft.extraValues[locale]).forEach((key) => {
        const [prefix] = key.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];

        if (
          prefix?.startsWith(`${keyPath}:`) &&
          !wrapper?.querySelector(`[data-key-path-prefix="${prefix}"]`)
        ) {
          delete draft.extraValues[locale][key];
        }
      });
    }, 500);
  };

  // Sync `inputValue` with `currentValue` in both directions
  syncValues(
    () => currentValue,
    (value) => {
      currentValue = value;
    },
    () => inputValue,
    (input) => {
      inputValue = input;
    },
    (value) => (typeof value === 'string' ? value : ''),
  );

  // Registered after the sync above, so it runs right after the input value has been updated
  watch(
    () => currentValue,
    () => {
      scheduleExtraValueCleanup();
    },
  );

  // Cancel the pending cleanup when the component is destroyed, e.g. when the content details
  // overlay is closed. Otherwise, the callback would read reactive state belonging to a destroyed
  // effect, causing a `derived_inert` warning.
  $effect(() => () => {
    window.clearTimeout(cleanupTimeout);
  });

  // While the editor holds a change made by the user, register it as a pending update: the editor
  // converts the content to Markdown with a short delay, so a save right after a change would
  // otherwise validate and write the previous value
  $effect(() => {
    if (!pending) {
      return undefined;
    }

    /** @type {PromiseWithResolvers<void>} */
    const { promise, resolve } = Promise.withResolvers();

    trackPendingFieldUpdate(promise);

    // Settle once the value has reached `currentValue` through the bindings and effects, or when
    // the editor goes away
    return async () => {
      await tick();
      resolve();
    };
  });
</script>

<div role="none" class="wrapper" class:minimal bind:this={wrapper}>
  {#await sleep() then}
    <!--
      Reset the editor when the configuration changes. It happens when fields are reordered or
      removed in a variable type list field. @see https://github.com/sveltia/sveltia-cms/issues/480
    -->
    {#key JSON.stringify(fieldConfig)}
      <TextEditor
        lang={getCanonicalLocale(locale)}
        dir={getDirection(locale)}
        {format}
        {modes}
        {buttons}
        {components}
        {useEmojiAutocomplete}
        {useMarkdownShortcuts}
        bind:value={inputValue}
        bind:pending
        flex
        {readonly}
        {required}
        {invalid}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
        autoResize={true}
        onpastecapture={(/** @type {ClipboardEvent} */ event) => {
          // Use `capture` to handle the event before Lexical does
          onPaste(event);
        }}
        ondrop={(/** @type {DragEvent} */ event) => {
          onDrop(event);
        }}
      />
    {/key}
  {/await}
</div>

<style>
  .wrapper {
    --sui-paragraph-margin: 20px;
    display: contents;

    &.minimal {
      :global {
        :is([role='textbox'], textarea) {
          overflow: auto;
          max-height: 240px;
        }
      }
    }

    :global {
      @media (width < 768px) {
        .sui.text-editor {
          /* Remove the section padding */
          margin: 0 calc(var(--field-editor-padding) * -1) calc(var(--field-editor-padding) * -1);
          width: 100dvw;
        }

        :is(.sui.toolbar, .lexical-root, textarea) {
          border: 0;
          border-radius: 0;
        }
      }
    }
  }
</style>
