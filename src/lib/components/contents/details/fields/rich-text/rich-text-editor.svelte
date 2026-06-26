<!--
  @component
  Implement the editor for a Markdown/RichText field.
  @see https://decapcms.org/docs/widgets/#Markdown
  @see https://sveltiacms.app/en/docs/fields/richtext
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import { getDateTimeParts } from '@sveltia/utils/datetime';
  import { sleep } from '@sveltia/utils/misc';
  import {
    $createParagraphNode as createParagraphNode,
    getNearestEditorFromDOMNode,
    $insertNodes as insertNodes,
  } from 'lexical';
  import { getContext, untrack } from 'svelte';

  import { cmsConfig } from '$lib/services/config';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getField } from '$lib/services/contents/entry/fields';
  import { getAssetLibraryFolderMap } from '$lib/services/contents/fields/file/helper';
  import { processResource } from '$lib/services/contents/fields/file/process';
  import {
    BUILTIN_COMPONENTS,
    BUTTON_NAME_MAP,
    COMPONENT_NAME_PREFIX_REGEX,
    DEFAULT_BUTTONS,
    DEFAULT_MODES,
    NODE_NAME_MAP,
  } from '$lib/services/contents/fields/rich-text';
  import { EditorComponent } from '$lib/services/contents/fields/rich-text/components';
  import {
    customComponentRegistry,
    getComponentDef,
  } from '$lib/services/contents/fields/rich-text/components/definitions';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import {
    RASTER_IMAGE_EXTENSION_REGEX,
    SUPPORTED_IMAGE_TYPES,
    VECTOR_IMAGE_EXTENSION_REGEX,
  } from '$lib/services/utils/media/image';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import {
   * EditorComponentDefinition,
   * ImageField,
   * MarkdownField,
   * RichTextField,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {{ file?: File, src?: string, alt?: string }} ImageEntry
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  const DATA_URL_REGEX = /^data:(?<type>image\/.+?);base64,.+/;

  const defaultConfig = $cmsConfig?.field_defaults?.richtext ?? {};
  /** @type {FieldEditorContext} */
  const { fieldContext, parentComponentNames, valueStoreKey } = getContext('field-editor') ?? {};
  const inEditorComponent = fieldContext === 'rich-text-editor-component';

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

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  let inputValue = $state('');

  let cleanupTimeout = 0;

  const {
    // Field type-specific options
    modes: _modes = defaultConfig.modes ?? [...DEFAULT_MODES],
    buttons: _buttons = defaultConfig.buttons ?? [...DEFAULT_BUTTONS],
    editor_components: _editorComponents = defaultConfig.editor_components ??
      // Include all built-in and custom components by default
      [...BUILTIN_COMPONENTS, ...customComponentRegistry.keys()],
    allow_nested_components: _allowNestedComponents,
    linked_images: linkedImagesEnabled = defaultConfig.linked_images ?? true,
    minimal = defaultConfig.minimal ?? false,
  } = $derived(fieldConfig);
  const modes = $derived(_modes.map((name) => NODE_NAME_MAP[name]).filter(Boolean));
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const valueMap = $derived($state.snapshot($entryDraft?.[valueStoreKey][locale]) ?? {});
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

    return _editorComponents
      .filter((name) =>
        allowNestedComponents === 'exclude_self' ? !parentComponentNames.includes(name) : true,
      )
      .map((name) =>
        getComponentDef(name === 'image' && linkedImagesEnabled ? 'linked-image' : name),
      )
      .filter((def) => !!def)
      .map(
        (def) =>
          /** @type {import('@sveltia/ui').TextEditorComponent} */ (new EditorComponent(def)),
      );
  });
  const imageComponent = $derived(
    components.find(({ id }) => id === 'image' || id === 'linked-image'),
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

    if (!$entryDraft || !imageComponent || !outer?.matches('.lexical-root') || !editor) {
      return;
    }

    const srcFieldConfig =
      /** @type {import('@sveltia/ui').TextEditorComponent & EditorComponentDefinition} */ (
        imageComponent
      ).fields?.find(({ name }) => name === 'src');

    const { config: libraryConfig } = getDefaultMediaLibraryOptions({
      fieldConfig: /** @type {ImageField} */ (srcFieldConfig),
    });

    const folderMap = getAssetLibraryFolderMap({ collectionName, fileName, isIndexFile });
    const folder = Object.values(folderMap).find(({ enabled }) => enabled)?.folder;
    const draft = $entryDraft;

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
   * Handle pasted file. If it’s an image, insert it to the editor content.
   * @param {ClipboardEvent} event `paste` event.
   */
  const onPaste = async (event) => {
    const { target, clipboardData } = event;
    const pastedItems = clipboardData?.items;

    if (!pastedItems) {
      return;
    }

    /** @type {ImageEntry[]} */
    let images = [];

    const fileIndex = [...pastedItems].findIndex(
      ({ kind, type }) => kind === 'file' && SUPPORTED_IMAGE_TYPES.includes(type),
    );

    const htmlIndex = [...pastedItems].findIndex(
      ({ kind, type }) => kind === 'string' && type === 'text/html',
    );

    if (fileIndex > -1 && htmlIndex > -1) {
      // Handle pasted remote files: When a remote image is copied within the browser, both file and
      // HTML with `<img>` are added to the clipboard. Scrape the filename and alt text from the
      // HTML content
      const file = fileIndex > -1 ? pastedItems[fileIndex].getAsFile() : undefined;

      if (!file) {
        return;
      }

      // Clear the clipboard to prevent Lexical from pasting the HTML
      pastedItems.clear();
      event.stopPropagation();

      let alt = '';
      let _fileName = file.name;

      /** @type {?HTMLImageElement} */
      const img = await new Promise((resolve) => {
        pastedItems[htmlIndex].getAsString((str) => {
          resolve(new DOMParser().parseFromString(str, 'text/html').querySelector('img'));
        });
      });

      if (img) {
        alt = img.alt;

        if (/^https?:/.test(img.src)) {
          const name = new URL(img.src).pathname.split('/').pop() ?? '';

          if (RASTER_IMAGE_EXTENSION_REGEX.test(name) || VECTOR_IMAGE_EXTENSION_REGEX.test(name)) {
            _fileName = name;
          }
        }
      }

      images = [{ file: new File([file], _fileName, { type: file.type }), alt }];
    } else {
      // Handle pasted local files
      images = [...clipboardData.files]
        .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
        .map((file) => ({ file }));
    }

    if (images.length) {
      images = images.map(({ file, alt }, index) => {
        // Rename pasted file with generic name
        if (file?.name === 'image.png') {
          const { year, month, day, hour, minute, second } = getDateTimeParts();
          const suffix = images.length > 1 ? `-${index + 1}` : '';
          const _fileName = `${year}${month}${day}-${hour}${minute}${second}${suffix}.png`;

          file = new File([file], _fileName, { type: file.type });
        }

        return { file, alt };
      });

      await insertImages({ target, images });
    }
  };

  /**
   * Handle dropped file(s). If it’s an image, insert it to the editor content.
   * @param {DragEvent} event `drop` event.
   */
  const onDrop = async (event) => {
    const { target, dataTransfer } = event;
    const droppedFiles = dataTransfer?.files;
    /** @type {ImageEntry[]} */
    let images = [];

    if (droppedFiles?.length) {
      // Handle dropped local files
      images = [...droppedFiles]
        .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
        .map((file) => ({ file }));
    } else {
      // Handle dropped remote files: The clipboard doesn’t contain the file itself but the HTML may
      // contain `<img>`; use the `src` and `alt` attributes to insert a new image. We don’t fetch
      // the file unless a data URL is given, because it’s likely to fail due to the external site’s
      // CORS policy
      const html = event.dataTransfer?.getData('text/html');

      if (html) {
        const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');

        if (img) {
          const { src, alt } = img;
          const dataMatcher = src.match(DATA_URL_REGEX);
          /** @type {File | undefined} */
          let file = undefined;

          if (dataMatcher) {
            const type = dataMatcher.groups?.type ?? '';

            if (SUPPORTED_IMAGE_TYPES.includes(type)) {
              try {
                const blob = await (await fetch(src)).blob();
                const { year, month, day, hour, minute, second } = getDateTimeParts();
                const extension = type.split('/')[1];
                const _fileName = `${year}${month}${day}-${hour}${minute}${second}.${extension}`;

                file = new File([blob], _fileName, { type });
              } catch {
                return;
              }
            }
          }

          images = [{ file, src, alt }];
        }
      }
    }

    if (images.length) {
      await insertImages({ target, images });
    }
  };

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   */
  const setInputValue = () => {
    const newValue = typeof currentValue === 'string' ? currentValue : '';

    if (inputValue !== newValue) {
      inputValue = newValue;
    }

    // Skip cleanup when used as a nested component editor
    if (!$entryDraft || inEditorComponent) {
      return;
    }

    window.clearTimeout(cleanupTimeout);

    // Remove values that are not present in the editor anymore. Otherwise, they will trigger
    // validation errors when the entry is saved.
    cleanupTimeout = window.setTimeout(() => {
      Object.keys($entryDraft?.extraValues[locale] ?? {}).forEach((key) => {
        const [prefix] = key.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];

        if (
          prefix?.startsWith(`${keyPath}:`) &&
          !wrapper?.querySelector(`[data-key-path-prefix="${prefix}"]`)
        ) {
          delete $entryDraft.extraValues[locale][key];
        }
      });
    }, 500);
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} while avoiding a cycle dependency.
   */
  const setCurrentValue = () => {
    const newValue = inputValue;

    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $effect(() => {
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
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
        {modes}
        {buttons}
        {components}
        bind:value={inputValue}
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
