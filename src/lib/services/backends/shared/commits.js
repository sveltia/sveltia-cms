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
 * @param {FileChange[]} changes File changes to be saved.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Git commit type.
 * @param {Collection} [options.collection] Collection of an entry to be changed.
 * @returns {string} Formatted message.
 */
export const createCommitMessage = (changes, { commitType = 'update', collection } = {}) => {
  const { login = '', name = '' } = get(user);
  const [firstSlug = ''] = changes.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = changes.map(({ path }) => path);
  const { backend: { commit_messages: customCommitMessages = {} } = {} } = get(siteConfig);
  const collectionLabel = collection?.label_singular || collection?.label || collection?.name || '';
  let message = customCommitMessages[commitType] || defaultCommitMessages[commitType] || '';

  if (['create', 'update', 'delete'].includes(commitType)) {
    message = message
      .replaceAll('{{slug}}', firstSlug)
      .replaceAll('{{collection}}', collectionLabel)
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['uploadMedia', 'deleteMedia'].includes(commitType)) {
    message = message
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);

    if (remainingPaths.length) {
      message += ` +${remainingPaths.length}`;
    }
  }

  if (['openAuthoring'].includes(commitType)) {
    message = message
      .replaceAll('{{message}}', commitType)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  return message;
};
