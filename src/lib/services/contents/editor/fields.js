import { sleep } from '@sveltia/utils/misc';
import { escapeRegExp } from '@sveltia/utils/string';

import { getField, LIST_KEY_PATH_REGEX } from '$lib/services/contents/entry/fields';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, ObjectField, ListField } from '$lib/types/public';
 */

/**
 * Cache of pre-compiled regexes keyed by cleaned key path.
 * @type {Map<string, RegExp>}
 */
const expanderRegexCache = new Map();
/**
 * Expander state changes accumulated by {@link syncExpanderStates}, waiting to be written to the
 * entry draft, keyed by draft. A draft has no entry when no flush is scheduled for it.
 * @type {WeakMap<EntryDraft, Record<FieldKeyPath, boolean>>}
 */
const pendingExpanderStates = new WeakMap();

/**
 * Apply the accumulated expander state changes to the entry draft in one go.
 * @param {EntryDraft} draft Entry draft.
 */
const flushExpanderStates = (draft) => {
  // Always set, because the flush is only scheduled right after the map is created
  const stateMap = /** @type {Record<FieldKeyPath, boolean>} */ (pendingExpanderStates.get(draft));

  pendingExpanderStates.delete(draft);

  Object.entries(stateMap).forEach(([keyPath, expanded]) => {
    draft.expanderStates._[keyPath] = expanded;
  });
};

/**
 * Get the initial object/list expander state based on the `collapsed` option. If `collapsed` is set
 * to `auto`, it checks if there are any values in the object. Otherwise, it uses the `collapsed`
 * option directly, which defaults to `false` (expanded).
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.key Key path of the item. For a List field, it’s a key path of the list
 * item, e.g. `authors.0`. For an Object field, it’s a key path of the object with the `#` suffix,
 * e.g. `details#`.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean | 'auto'} [args.collapsed] The `collapsed` option value.
 * @returns {boolean} Whether th expander should be expanded.
 */
export const getInitialExpanderState = ({ draft, key, locale, collapsed = false }) => {
  // A state that is queued but not written yet is still the authoritative one
  const currentState = pendingExpanderStates.get(draft)?.[key] ?? draft.expanderStates?._[key];

  if (currentState !== undefined) {
    return currentState;
  }

  if (collapsed === 'auto') {
    const valueMap = draft.currentValues?.[locale] ?? {};
    const cleanKey = key.replace(/#$/, '');

    // Pre-compile and cache the regex — same key path is queried on every editor render.
    const regex = getOrCreate(
      expanderRegexCache,
      cleanKey,
      () => new RegExp(`^${escapeRegExp(cleanKey)}\\.[^\\.]+$`),
    );

    return !Object.entries(valueMap).some(([keyPath, value]) => regex.test(keyPath) && !!value);
  }

  return !collapsed;
};

/**
 * Check whether the object/list expander at the given key path is expanded, which it is until it’s
 * collapsed.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @param {string} key Key path of the expander, e.g. `authors.0` for a list item or `details#` for
 * an Object field or a List field itself.
 * @returns {boolean} Result.
 */
export const isExpanded = (draft, key) => draft?.expanderStates?._[key] ?? true;

/**
 * Sync the field object/list expander states between locales.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Record<FieldKeyPath, boolean>} args.stateMap Map of key path and state.
 */
export const syncExpanderStates = ({ draft, stateMap }) => {
  const currentStates = draft.expanderStates?._;

  if (!currentStates) {
    return;
  }

  let pendingStates = pendingExpanderStates.get(draft);

  const changes = Object.entries(stateMap).filter(
    ([keyPath, expanded]) => (pendingStates?.[keyPath] ?? currentStates[keyPath]) !== expanded,
  );

  // Object/List editors call this as they mount, so revealing n of them — by expanding a field or
  // merely scrolling — would write to the draft n times in a row. Drop no-op changes, and coalesce
  // the rest into a single write per tick, which is enough to collapse a whole mount storm into
  // one update.
  if (!changes.length) {
    return;
  }

  if (!pendingStates) {
    pendingStates = {};
    pendingExpanderStates.set(draft, pendingStates);
    queueMicrotask(() => flushExpanderStates(draft));
  }

  Object.assign(pendingStates, Object.fromEntries(changes));
};

/**
 * Get a list of keys for the expander states, given the key path. The returned keys could include
 * nested lists and objects.
 * @param {object} args Partial arguments for {@link getField}.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Key path, e.g. `testimonials.0.authors.2.foo`.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {string[]} Keys, e.g. `['testimonials', 'testimonials.0', 'testimonials.0.authors',
 * 'testimonials.0.authors.2', 'testimonials.0.authors.2.foo']`.
 */
export const getExpanderKeys = ({
  collectionName,
  fileName,
  valueMap,
  keyPath,
  isIndexFile = false,
}) => {
  const keys = new Set();
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };

  keyPath.split('.').forEach((_keyPart, index, arr) => {
    const _keyPath = arr.slice(0, index + 1).join('.');
    const config = getField({ ...getFieldArgs, keyPath: _keyPath });
    const endingWithNumber = LIST_KEY_PATH_REGEX.test(_keyPath);

    if (config?.widget === 'object') {
      if (endingWithNumber) {
        keys.add(_keyPath);
      }

      keys.add(`${_keyPath}#`);
    } else if (config?.widget === 'list') {
      keys.add(endingWithNumber ? _keyPath : `${_keyPath}#`);
    } else if (index > 0) {
      const parentKeyPath = arr.slice(0, index).join('.');
      const parentConfig = getField({ ...getFieldArgs, keyPath: parentKeyPath });

      if (
        parentConfig?.widget === 'object' &&
        'fields' in /** @type {ObjectField} */ (parentConfig)
      ) {
        keys.add(`${parentKeyPath}.${parentConfig.name}#`);
      }

      // A list item is expanded by its own key: `config` is the subfield of a List field with
      // `field`, or the resolved type of a List field with `types`, which has no `widget`
      if (
        parentConfig?.widget === 'list' &&
        ('field' in /** @type {ListField} */ (parentConfig) ||
          'types' in /** @type {ListField} */ (parentConfig))
      ) {
        keys.add(_keyPath);
      }
    }
  });

  return [...keys];
};

/**
 * Expand any invalid fields, including the parent list/object(s).
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 */
export const expandInvalidFields = ({ draft }) => {
  const { collectionName, fileName, currentValues, validities, isIndexFile } = draft;
  /** @type {Record<FieldKeyPath, boolean>} */
  const stateMap = {};

  Object.entries(validities ?? {}).forEach(([locale, validityMap]) => {
    Object.entries(validityMap).forEach(([keyPath, { valid }]) => {
      if (!valid) {
        getExpanderKeys({
          collectionName,
          fileName,
          valueMap: currentValues[locale],
          keyPath,
          isIndexFile,
        }).forEach((key) => {
          stateMap[key] = true;
        });
      }
    });
  });

  syncExpanderStates({ draft, stateMap });
};

/**
 * Highlight the corresponding field in the editor by posting a message to the window.
 * @param {object} args Arguments object.
 * @param {InternalLocaleCode} args.locale The locale of the field to highlight.
 * @param {FieldKeyPath} args.keyPath The key path of the field to highlight.
 */
export const highlightEditorField = ({ locale, keyPath }) => {
  window.postMessage(
    { type: 'highlight-editor-field', payload: { locale, keyPath } },
    window.location.origin,
  );
};

/**
 * Get the last rendered field of the deepest rendered parent of the given field in an edit pane.
 * @param {HTMLElement} pane Edit pane element.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {HTMLElement | undefined} Field element.
 */
const getLastRenderedParentField = (pane, keyPath) => {
  const parts = keyPath.split('.');

  // Deepest parent first, then the root
  for (let depth = parts.length - 1; depth >= 0; depth -= 1) {
    const parentKeyPath = parts.slice(0, depth).join('.');

    /** @type {NodeListOf<HTMLElement>} */
    const fields = pane.querySelectorAll(
      parentKeyPath
        ? `.field[data-key-path^="${CSS.escape(`${parentKeyPath}.`)}"]`
        : '.field[data-key-path]',
    );

    if (fields.length) {
      return fields[fields.length - 1];
    }
  }

  return undefined;
};

/**
 * Find the field with the given key path in the edit pane for the given locale. The pane renders
 * fields lazily as they scroll into view, so a field just revealed by expanding its parents may not
 * be rendered yet, especially near the bottom of the pane. In that case, scroll the pane towards
 * the field, to the last rendered field of its deepest rendered parent, until it’s rendered or no
 * more fields are rendered.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Locale of the edit pane.
 * @param {FieldKeyPath} args.keyPath Key path of the field. The path editor isn’t a field, so it’s
 * marked with a validation key instead of a key path; that’s matched as well.
 * @param {number} [args.maxAttempts] How many times to scroll the pane before giving up.
 * @param {number} [args.interval] How long to wait for fields to render after scrolling, in
 * milliseconds.
 * @returns {Promise<HTMLElement | null>} Field element, or `null` if it couldn’t be found.
 */
export const findEditorField = async ({ locale, keyPath, maxAttempts = 20, interval = 100 }) => {
  const key = CSS.escape(keyPath);
  const selector = `.field:is([data-key-path="${key}"], [data-validation-key="${key}"])`;

  // Let the expanded parents render first
  await new Promise((resolve) => {
    window.requestAnimationFrame(resolve);
  });

  /** @type {HTMLElement | null} */
  const pane = document.querySelector(
    `.content-editor .pane[data-mode="edit"][data-locale="${CSS.escape(locale)}"]`,
  );

  if (!pane) {
    return null;
  }

  /** @type {HTMLElement | undefined} */
  let previousLastRenderedField;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    /** @type {HTMLElement | null} */
    const field = pane.querySelector(selector);

    if (field || !pane.isConnected) {
      return field;
    }

    const lastRenderedField = getLastRenderedParentField(pane, keyPath);

    // Stop if no more fields are rendered after scrolling, e.g. when the field doesn’t exist or is
    // hidden by a condition
    if (!lastRenderedField || lastRenderedField === previousLastRenderedField) {
      return null;
    }

    previousLastRenderedField = lastRenderedField;
    lastRenderedField.scrollIntoView({ block: 'center' });

    // eslint-disable-next-line no-await-in-loop
    await sleep(interval);
  }

  return pane.querySelector(selector);
};

/**
 * Reveal the field with the given key path in the edit pane for the given locale: expand its parent
 * List and Object fields, move it into the viewport, and focus any control within it, such as a
 * text input or button.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale of the edit pane.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {() => boolean} [args.isOutdated] Function telling whether the request has been
 * superseded by a newer one while the field was being looked up, in which case it’s left alone.
 * @returns {Promise<void>} A promise that resolves once the field has been revealed, or couldn’t
 * be found.
 */
export const revealEditorField = async ({ draft, locale, keyPath, isOutdated = () => false }) => {
  const { collectionName, fileName, currentValues, isIndexFile } = draft;

  const expanderKeys = getExpanderKeys({
    collectionName,
    fileName,
    valueMap: currentValues[locale] ?? {},
    keyPath,
    isIndexFile,
  });

  syncExpanderStates({
    draft,
    stateMap: Object.fromEntries(expanderKeys.map((key) => [key, true])),
  });

  const targetField = await findEditorField({ locale, keyPath });

  // Finding the field can take a while, so leave it to a newer request that came in meanwhile
  if (!targetField || isOutdated()) {
    return;
  }

  // `scrollIntoViewIfNeeded()` is non-standard; Firefox doesn’t have it
  if (typeof targetField.scrollIntoViewIfNeeded === 'function') {
    targetField.scrollIntoViewIfNeeded();
  } else {
    targetField.scrollIntoView();
  }

  const widgetWrapper = targetField.querySelector('.field-wrapper');

  /** @type {HTMLElement | null} */ (
    widgetWrapper?.querySelector('[contenteditable="true"], [tabindex="0"]') ??
      widgetWrapper?.querySelector('input, textarea, button')
  )?.focus();
};

/**
 * Highlight the Edit Pane field that corresponds to an element in a custom preview template, just
 * like clicking a field in the default preview does. The template marks the element with the
 * `data-key-path` attribute, which Scroll Synchronization also uses. A click on the element or
 * anything inside it highlights the field of the innermost marked element, while the Enter key
 * does so only when the marked element itself has the focus, so it doesn’t get in the way of a
 * focused link or form control. The template can opt out by calling `preventDefault()`.
 * @param {object} args Arguments.
 * @param {MouseEvent | KeyboardEvent} args.event `click` or `keydown` event on the preview frame’s
 * document.
 * @param {InternalLocaleCode} args.locale Locale of the Preview Pane.
 * @see https://github.com/sveltia/sveltia-cms/issues/1029
 */
export const highlightPreviewTemplateField = ({ event, locale }) => {
  const isKeyDown = event.type === 'keydown';

  if (
    event.defaultPrevented ||
    (isKeyDown && /** @type {KeyboardEvent} */ (event).key !== 'Enter')
  ) {
    return;
  }

  // The target comes from the frame’s realm, so `instanceof Element` can’t be used. A key event
  // always targets an element, while a click event can be dispatched to the document
  const { target } = event;

  const element = /** @type {Element | null | undefined} */ (
    isKeyDown ? target : /** @type {Element} */ (target).closest?.('[data-key-path]')
  );

  const keyPath = element?.getAttribute('data-key-path');

  if (keyPath) {
    highlightEditorField({ locale, keyPath });
  }
};
