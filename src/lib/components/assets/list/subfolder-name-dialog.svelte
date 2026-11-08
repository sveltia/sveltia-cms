<!--
  @component
  Dialog asking for the name of a subfolder, shared by the New Folder and Rename Folder dialogs of
  the Asset Library and the asset picker. It validates the name against the names already taken in
  the parent folder, and hands the formatted name over to the caller.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import NameInputDialog from '$lib/components/assets/list/name-input-dialog.svelte';
  import { formatSubfolderName, validateSubfolderName } from '$lib/services/assets/subfolders';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} title Dialog title.
   * @property {string} okLabel Label of the OK button.
   * @property {string} description Text shown above the input field.
   * @property {string} [warning] Warning shown below the description, e.g. that entries linking to
   * the files in the folder will break once it’s renamed. The name can still be submitted.
   * @property {string} [name] Current folder name, shown in the input field when renaming. Empty
   * for a new folder.
   * @property {string[]} takenNames Names of the files and folders already in the parent folder,
   * which the new name must not duplicate. The current name is not among these when renaming.
   * @property {(name: string) => void} onSubmit Called with the formatted name once confirmed.
   * @property {() => void} [onClose] Called once the dialog has closed, after `onSubmit` if it was
   * confirmed.
   */

  /** @type {Props} */
  let {
    open = $bindable(false),
    title,
    okLabel,
    description,
    warning = undefined,
    name = '',
    takenNames,
    onSubmit,
    onClose = undefined,
  } = $props();

  let newName = $state('');
  /**
   * Whether the folder name has been typed in yet. An empty name is only reported once the field
   * has been used, so the dialog doesn’t open with an error against a field nobody has touched.
   */
  let nameEdited = $state(false);

  const error = $derived(validateSubfolderName({ name: newName, takenNames }));
  const invalid = $derived(nameEdited && !!error);
  /** Whether the name is what it was, so there is nothing to rename. */
  const unchanged = $derived(!!name && formatSubfolderName(newName) === name);

  // Reset the input whenever the dialog is opened
  $effect(() => {
    if (open) {
      newName = name;
      nameEdited = false;
    }
  });
</script>

<NameInputDialog
  {title}
  bind:open
  {okLabel}
  okDisabled={!!error || unchanged}
  onOk={() => {
    onSubmit(formatSubfolderName(newName));
  }}
  {onClose}
  {description}
  {warning}
  bind:value={newName}
  ariaLabel={_('new_folder_name')}
  oninput={() => {
    nameEdited = true;
  }}
  error={invalid ? _(`new_folder_error.${error}`) : undefined}
/>
