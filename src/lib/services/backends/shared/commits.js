import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { user } from '$lib/services/user';

/**
 * Default commit message templates.
 * @see https://decapcms.org/docs/beta-features/#commit-message-templates
 */
const defaultCommitMessages = {
  create: 'Create {{collection}} “{{slug}}”',
  update: 'Update {{collection}} “{{slug}}”',
  delete: 'Delete {{collection}} “{{slug}}”',
  uploadMedia: 'Upload “{{path}}”',
  deleteMedia: 'Delete “{{path}}”',
  openAuthoring: '{{message}}',
};

/**
 * Create a Git commit message.
 * @param {SavingFile[] | DeletingFile[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Git commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 * @returns {string} Formatted message.
 */
export const createCommitMessage = (items, { commitType = 'update', collection = '' } = {}) => {
  const { login = '', name = '' } = get(user);
  const [firstSlug = ''] = items.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = items.map(({ path }) => path);
  const { backend: { commit_messages: customCommitMessages = {} } = {} } = get(siteConfig);
  /**
   * @type {string}
   */
  let message = customCommitMessages[commitType] || defaultCommitMessages[commitType] || '';

  if (['create', 'update', 'delete'].includes(commitType)) {
    message = message
      .replaceAll('{{slug}}', firstSlug)
      .replaceAll('{{collection}}', collection)
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['uploadMedia', 'deleteMedia'].includes(commitType)) {
    message = message
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['openAuthoring'].includes(commitType)) {
    message = message
      .replaceAll('{{message}}', commitType)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (remainingPaths.length) {
    message += ` +${remainingPaths.length}`;
  }

  return message;
};
