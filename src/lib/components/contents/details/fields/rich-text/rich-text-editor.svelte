<!--
  @component
  Implement the editor for a Markdown/RichText field.
  @see https://decapcms.org/docs/widgets/#Markdown
  @see https://sveltiacms.app/en/docs/fields/richtext
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, TextEditor, Toast } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import {
    $createParagraphNode as createParagraphNode,
    getNearestEditorFromDOMNode,
    $insertNodes as insertNodes,
  } from 'lexical';

  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import { EditorComponent } from '$lib/components/contents/details/fields/rich-text/custom-node-features';
  import { cmsConfig } from '$lib/services/config';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getFieldEditorContext,
    isInEditorComponent,
  } from '$lib/services/contents/editor/field-context';
  import { trackPendingWhile } from '$lib/services/contents/editor/pending.svelte';
  import { getField } from '$lib/services/contents/entry/fields';
  import { processResource } from '$lib/services/contents/fields/file/process';
  import {
    getMediaFieldAssetOptions,
    processResources,
  } from '$lib/services/contents/fields/file/resources';
  import {
    DEFAULT_BUTTONS,
    DEFAULT_MODES,
    getValueFormat,
    NODE_NAME_MAP,
  } from '$lib/services/contents/fields/rich-text';
  import { IMAGE_COMPONENT_IDS } from '$lib/services/contents/fields/rich-text/components/definitions';
  import {
    getImageSrcFieldConfig,
    sortDroppedImages,
  } from '$lib/services/contents/fields/rich-text/image-uploads';
  import {
    getDroppedImages,
    getPastedImages,
  } from '$lib/services/contents/fields/rich-text/images';
  import {
    getAvailableComponentDefs,
    getEditorComponentNames,
    getRootFieldName,
    getStaleExtraValueKeys,
    getToolbarButtons,
    resolveAllowNestedComponents,
  } from '$lib/services/contents/fields/rich-text/options';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { syncValues, watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { ImageEntry } from '$lib/services/contents/fields/rich-text/images';
   * @import { FieldEditorProps, SelectedResource } from '$lib/types/private';
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
  const { parentComponentNames, valueStoreKey } = getFieldEditorContext();
  /* v8 ignore stop */
  const inEditorComponent = isInEditorComponent(valueStoreKey);
  const componentName = parentComponentNames.at(-1);

  /** @type {FieldEditorProps & Props} */
  let {
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  let inputValue = $state('');

  let cleanupTimeout = 0;
  /**
   * Whether the editor has yet to write a change made by the user back to {@link inputValue}.
   */
  let pending = $state(false);
  /**
   * Number of dropped or pasted image batches being processed before they’re inserted.
   */
  let processingImages = $state(0);
  let showSelectAssetsDialog = $state(false);
  /**
   * Files dropped or pasted into the editor, to be uploaded to a cloud storage service in the
   * Select Assets dialog.
   * @type {File[]}
   */
  let pendingFiles = $state([]);
  /**
   * Inserts the images uploaded in the Select Assets dialog into the editor the files were dropped
   * or pasted into.
   * @type {((resources: SelectedResource[]) => Promise<void>) | undefined}
   */
  let insertUploadedImages = undefined;
  /** Whether dropped or pasted files have been rejected, as no location can take them. */
  let filesRejected = $state(false);

  const {
    // Field type-specific options
    modes: _modes = defaultConfig.modes ?? [...DEFAULT_MODES],
    buttons: _buttons = defaultConfig.buttons ?? [...DEFAULT_BUTTONS],
    use_emoji_autocomplete: useEmojiAutocomplete = defaultConfig.use_emoji_autocomplete ?? true,
    use_markdown_shortcuts: useMarkdownShortcuts = defaultConfig.use_markdown_shortcuts ?? true,
    minimal = defaultConfig.minimal ?? false,
    multiline = defaultConfig.multiline ?? true,
  } = $derived(fieldConfig);
  const format = $derived(getValueFormat(fieldConfig));
  const modes = $derived(_modes.map((name) => NODE_NAME_MAP[name]).filter(Boolean));
  /* v8 ignore start -- the editor is only rendered while the draft is there */
  const isIndexFile = $derived(entryDraft.current?.isIndexFile ?? false);
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);
  const valueMap = $derived(
    getFieldValueMapSnapshot(entryDraft.current, locale, keyPath, valueStoreKey),
  );
  const componentNames = $derived(getEditorComponentNames(fieldConfig));
  const buttons = $derived(getToolbarButtons(_buttons, componentNames));
  const allowNestedComponents = $derived(
    resolveAllowNestedComponents(
      inEditorComponent
        ? // Retrieve the parent Markdown or RichText field config
          /** @type {MarkdownField | RichTextField | undefined} */ (
            getField({
              collectionName,
              fileName,
              isIndexFile,
              valueMap,
              keyPath: getRootFieldName(keyPath),
            })
          )
        : fieldConfig,
    ),
  );
  const components = $derived(
    getAvailableComponentDefs({
      fieldConfig,
      format,
      allowNestedComponents,
      inEditorComponent,
      parentComponentNames,
    }).map(
      (def) => /** @type {import('@sveltia/ui').TextEditorComponent} */ (new EditorComponent(def)),
    ),
  );
  const imageComponent = $derived(components.find(({ id }) => IMAGE_COMPONENT_IDS.includes(id)));
  const srcFieldConfig = $derived(
    getImageSrcFieldConfig(
      /** @type {import('@sveltia/ui').TextEditorComponent & EditorComponentDefinition} */ (
        imageComponent
      ),
    ),
  );
  const assetOptions = $derived(
    getMediaFieldAssetOptions({
      collectionName,
      fileName,
      isIndexFile,
      componentName,
      typedKeyPath,
      fieldConfig: /** @type {ImageField} */ (srcFieldConfig),
    }),
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

    const { folder, libraryConfig } = assetOptions;
    const draft = entryDraft.current;
    const _locale = locale;
    const component = imageComponent;

    const { inlineImages, uploadFiles, rejected } = sortDroppedImages({
      images,
      srcFieldConfig,
      assetOptions,
    });

    /**
     * Whether the editor still shows the content the images were dropped in. The editor is reused
     * when the pane switches to another locale or another entry is opened, so the image would be
     * inserted into the content it shows now, with a path resolved for the one it was dropped in.
     * @returns {boolean} Result.
     */
    const isSameContent = () => entryDraft.current === draft && locale === _locale;

    /**
     * Insert an image.
     * @param {string} src Image URL.
     * @param {string} alt Alternative text.
     */
    const insertImage = (src, alt) => {
      editor.update(() => {
        const node = component.createNode({ src, alt });

        // Start a new paragraph after the image, unless the field holds a single one
        insertNodes(multiline ? [node, createParagraphNode()] : [node]);
      });
    };

    processingImages += 1;

    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const { file, src: externalSrc, alt = '' } of inlineImages) {
        let src = externalSrc;

        if (file) {
          // eslint-disable-next-line no-await-in-loop
          const { value } = await processResource({
            draft,
            resource: { file, folder },
            libraryConfig,
            locale: _locale,
          });

          if (!isSameContent()) {
            return;
          }

          src = value;
        }

        if (src) {
          insertImage(src, alt);
        }
      }
    } finally {
      processingImages -= 1;
    }

    if (rejected) {
      filesRejected = true;
    }

    if (!uploadFiles.length) {
      return;
    }

    /**
     * Insert the images the user has selected in the Select Assets dialog, which uploads the files
     * to the cloud storage service, asking for the credentials if needed.
     * @param {SelectedResource[]} resources Selected resources.
     */
    insertUploadedImages = async (resources) => {
      // A save made right after the images have been selected waits for them to be inserted
      processingImages += 1;

      try {
        const results = await processResources({
          draft,
          resources,
          folder,
          libraryConfig,
          locale: _locale,
        });

        if (isSameContent()) {
          results.forEach(({ value }) => {
            if (value) {
              insertImage(value, '');
            }
          });
        }
      } finally {
        processingImages -= 1;
      }
    };

    pendingFiles = uploadFiles;
    showSelectAssetsDialog = true;
  };

  /**
   * Create a handler for pasted or dropped content. If it includes images, they’re inserted to the
   * editor content.
   * @template {ClipboardEvent | DragEvent} E
   * @param {(event: E) => Promise<ImageEntry[]>} getImages Function getting the images from the
   * event.
   * @returns {(event: E) => Promise<void>} Event handler.
   */
  const createImageHandler = (getImages) => async (event) => {
    // Lexical applies an update even while the editor isn’t editable, so nothing is inserted to a
    // read-only field, nor is the file added to the draft
    if (readonly) {
      return;
    }

    const { target } = event;
    const images = await getImages(event);

    if (images.length) {
      await insertImages({ target, images });
    }
  };

  const onPaste = createImageHandler(getPastedImages);
  const onDrop = createImageHandler(getDroppedImages);

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
      getStaleExtraValueKeys(
        draft.extraValues[locale],
        keyPath,
        (prefix) => !!wrapper?.querySelector(`[data-key-path-prefix="${prefix}"]`),
      ).forEach((key) => {
        delete draft.extraValues[locale][key];
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
  // otherwise validate and write the previous value. A dropped or pasted image is only inserted
  // once it has been processed, which can take a while, e.g. converting a large HEIC photo, so a
  // save or a locale switch has to wait for that as well
  trackPendingWhile(() => pending || !!processingImages);
</script>

<div role="none" class="wrapper" bind:this={wrapper}>
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
        {minimal}
        {multiline}
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

{#if srcFieldConfig}
  <SelectAssetsDialog
    kind="image"
    multiple
    draft={entryDraft.current}
    {locale}
    fieldConfig={srcFieldConfig}
    assetLibraryFolderMap={assetOptions.folderMap}
    enabledCloudServiceEntries={assetOptions.cloudServiceEntries}
    bind:open={showSelectAssetsDialog}
    bind:pendingFiles
    onSelect={(resources) => {
      insertUploadedImages?.(resources);
    }}
    onClose={() => {
      insertUploadedImages = undefined;
    }}
  />
{/if}

<Toast bind:show={filesRejected}>
  <Alert status="error">{_('uploading_files_failed')}</Alert>
</Toast>

<style>
  .wrapper {
    --sui-paragraph-margin: 20px;
    display: contents;

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
