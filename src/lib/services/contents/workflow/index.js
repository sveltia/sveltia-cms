import { derived, get, writable } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { Entry } from '$lib/types/private';
 */

/**
 * @typedef {'draft' | 'in_review' | 'ready'} WorkflowStatus
 */

/**
 * Valid workflow status transitions.
 * @type {Record<WorkflowStatus, WorkflowStatus[]>}
 */
const VALID_TRANSITIONS = {
  draft: ['in_review'],
  in_review: ['draft', 'ready'],
  ready: ['in_review'],
};

/**
 * Locale keys for displaying status labels.
 * @type {Record<WorkflowStatus, string>}
 */
export const STATUS_LABEL_KEYS = {
  draft: 'status.drafts',
  in_review: 'status.in_review',
  ready: 'status.ready',
};

/**
 * Locale keys for transition action labels (action-oriented verbs).
 * @type {Record<WorkflowStatus, string>}
 */
export const TRANSITION_LABEL_KEYS = {
  draft: 'workflow_action.set_draft',
  in_review: 'workflow_action.submit_for_review',
  ready: 'workflow_action.set_ready',
};

/**
 * Icons for transition action buttons.
 * @type {Record<WorkflowStatus, string>}
 */
export const TRANSITION_ICONS = {
  draft: 'undo',
  in_review: 'rate_review',
  ready: 'check_circle',
};

// Fallback store used when `cmsConfig` or `allEntries` is undefined in test environments
// where modules are auto-mocked. Required for test compatibility.
/** @type {Writable<undefined>} */
const fallbackStore = writable(undefined);

/**
 * localStorage key for persisting workflow statuses across page reloads.
 * Provides intermediate persistence until entries are formally saved to Git.
 * @type {string}
 */
const LOCAL_STORAGE_KEY = 'sveltia-cms-workflow-statuses';

/**
 * Load workflow statuses from localStorage.
 * @returns {Map<string, WorkflowStatus>} Status map from localStorage.
 */
const loadFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!stored) {
      return new Map();
    }

    const parsed = JSON.parse(stored);

    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
};

/**
 * Save workflow statuses to localStorage for intermediate persistence.
 * @param {Map<string, WorkflowStatus>} statusMap Status map to save.
 */
const saveToLocalStorage = (statusMap) => {
  try {
    const obj = Object.fromEntries(statusMap);

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage errors (e.g., quota exceeded, private browsing)
  }
};

/**
 * Whether editorial workflow is enabled in the CMS configuration.
 * @type {Readable<boolean>}
 */
export const workflowEnabled = derived(cmsConfig ?? fallbackStore, ($config) => {
  return $config?.publish_mode === 'editorial_workflow';
});

/**
 * Internal store mapping entry IDs to their workflow status.
 * Subscribe to this store (via `$workflowStatuses`) for reactive access in Svelte components.
 * @type {Writable<Map<string, WorkflowStatus>>}
 */
export const workflowStatuses = writable(new Map());

/**
 * The key used in the frontmatter/content to store workflow status when editorial workflow is
 * enabled. We use a double-underscore prefix to signal it's internal metadata.
 * @type {string}
 */
export const WORKFLOW_STATUS_KEY = '__workflow_status';

/**
 * Get the workflow status of an entry. Uses imperative `get()` — for reactive access in Svelte
 * components, subscribe to `$workflowStatuses` directly instead.
 * @param {string} entryId Entry ID.
 * @returns {WorkflowStatus} The workflow status of the entry, defaulting to 'draft'.
 */
export const getEntryWorkflowStatus = (entryId) => {
  const statuses = get(workflowStatuses);

  return statuses?.get?.(entryId) ?? 'draft';
};

/**
 * Set the workflow status of an entry.
 * @param {string} entryId Entry ID.
 * @param {WorkflowStatus} status New workflow status.
 */
export const setEntryWorkflowStatus = (entryId, status) => {
  workflowStatuses.update((map) => {
    const newMap = new Map(map);

    newMap.set(entryId, status);
    saveToLocalStorage(newMap);

    return newMap;
  });
};

/**
 * Check if a transition from one status to another is valid.
 * @param {WorkflowStatus} from Current status.
 * @param {WorkflowStatus} to Target status.
 * @returns {boolean} Whether the transition is valid.
 */
export const isValidTransition = (from, to) => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

/**
 * Get the valid next statuses from the current status.
 * @param {WorkflowStatus} current Current workflow status.
 * @returns {WorkflowStatus[]} Array of valid next statuses.
 */
export const getNextStatuses = (current) => {
  return VALID_TRANSITIONS[current] ?? [];
};

/**
 * Transition an entry to a new workflow status.
 * @param {string} entryId Entry ID.
 * @param {WorkflowStatus} newStatus Target status.
 * @returns {boolean} Whether the transition was successful.
 */
export const transitionEntry = (entryId, newStatus) => {
  const currentStatus = getEntryWorkflowStatus(entryId);

  if (!isValidTransition(currentStatus, newStatus)) {
    return false;
  }

  setEntryWorkflowStatus(entryId, newStatus);

  return true;
};

/**
 * Check if an entry ID exists in the loaded entries.
 * @param {string} entryId Entry ID to validate.
 * @returns {boolean} Whether the entry exists.
 */
export const isKnownEntry = (entryId) => {
  const entries = get(allEntries);

  return !!entries?.some((e) => e.id === entryId);
};

/**
 * Get all entries grouped by their workflow status.
 * @type {Readable<Record<WorkflowStatus, Entry[]>>}
 */
export const entriesByWorkflowStatus = derived(
  [allEntries ?? fallbackStore, workflowStatuses, workflowEnabled],
  ([$allEntries, $workflowStatuses, $workflowEnabled]) => {
    /** @type {Record<WorkflowStatus, Entry[]>} */
    const grouped = {
      draft: [],
      in_review: [],
      ready: [],
    };

    if (!$workflowEnabled || !$allEntries) {
      return grouped;
    }

    $allEntries.forEach((entry) => {
      if (!entry.id) {
        return;
      }

      const status = $workflowStatuses.get(entry.id) ?? 'draft';

      grouped[status]?.push(entry);
    });

    return grouped;
  },
);

/**
 * Initialize workflow statuses from entry content. Called after entries are loaded from Git.
 * Scans entry content for the `__workflow_status` field and populates the status map.
 * Entries without an explicit status field default to 'ready' (assumed already published).
 * Merges with any existing in-memory statuses to avoid overwriting unsaved transitions.
 * @param {Entry[]} entries All entries.
 */
export const initWorkflowStatuses = (entries) => {
  if (!get(workflowEnabled)) {
    return;
  }

  // Load any persisted statuses from localStorage (survives page reloads)
  const localStatuses = loadFromLocalStorage();

  workflowStatuses.update((existing) => {
    const merged = new Map(existing);

    // Merge localStorage statuses (lower priority than Git content)
    localStatuses.forEach((status, id) => {
      if (!merged.has(id)) {
        merged.set(id, status);
      }
    });

    entries.forEach((entry) => {
      if (!entry.id) {
        return;
      }

      // Check if the entry has a workflow status stored in its content (highest priority)
      const defaultLocaleContent = Object.values(entry.locales)?.[0]?.content;

      if (defaultLocaleContent && WORKFLOW_STATUS_KEY in defaultLocaleContent) {
        const status = /** @type {WorkflowStatus} */ (defaultLocaleContent[WORKFLOW_STATUS_KEY]);

        if (['draft', 'in_review', 'ready'].includes(status)) {
          merged.set(entry.id, status);
        }
      } else if (!merged.has(entry.id)) {
        // Entries without an explicit workflow status are assumed to be already published
        merged.set(entry.id, 'ready');
      }
    });

    saveToLocalStorage(merged);

    return merged;
  });
};
