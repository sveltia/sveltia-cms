import { flushSync } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { commitMessageRequest } from '$lib/services/backends/commit-prompt';

import CommitMessageDialog from './commit-message-dialog.svelte';

/**
 * @import { CommitMessagePromptMode, CommitMessageRequest } from '$lib/types/private';
 */

const DEFAULT_MESSAGE = 'Update “Foo” in “Posts”';
/**
 * Wrap the given text in bidi isolates, as an interpolated value is.
 * @param {string} text Text.
 * @returns {string} Wrapped text.
 */
const isolate = (text) => `${String.fromCodePoint(0x2068)}${text}${String.fromCodePoint(0x2069)}`;

/**
 * Create a commit message request that clears itself when answered, like the real one.
 * @param {CommitMessagePromptMode} mode Mode.
 * @param {string} [initialValue] Initial value of the text box.
 * @returns {CommitMessageRequest} Request.
 */
const createRequest = (mode, initialValue = mode === true ? DEFAULT_MESSAGE : '') => {
  /** @type {CommitMessageRequest} */
  const request = {
    mode,
    defaultMessage: DEFAULT_MESSAGE,
    initialValue,
    respond: vi.fn(() => {
      if (commitMessageRequest.current === request) {
        commitMessageRequest.current = undefined;
      }
    }),
  };

  return request;
};

/**
 * Show the dialog for the given request.
 * @param {CommitMessageRequest} request Request.
 */
const renderDialog = async (request) => {
  commitMessageRequest.current = request;

  await render(CommitMessageDialog, {});
};

/**
 * Get the dialog.
 * @returns {import('vitest/browser').Locator} Locator.
 */
const getDialog = () => page.getByRole('alertdialog', { name: 'Commit Message' });

describe('CommitMessageDialog', () => {
  beforeEach(() => {
    commitMessageRequest.current = undefined;
  });

  test('is closed while no request is pending', async () => {
    await render(CommitMessageDialog, {});

    expect(page.getByRole('alertdialog').elements()).toHaveLength(0);
  });

  test('asks for the whole message', async () => {
    await renderDialog(createRequest(true));

    const dialog = getDialog();
    const textbox = dialog.getByRole('textbox', { name: 'Commit message' });

    await expect
      .element(dialog)
      .toMatchTextContent(
        'Describe your changes. The message is recorded in the history along with them.',
      );
    await expect.element(textbox).toHaveValue(DEFAULT_MESSAGE);
    await expect.element(textbox).not.toHaveAttribute('aria-describedby');
    expect(dialog.getByText(/^Message:/).elements()).toHaveLength(0);
  });

  test('previews a prefix', async () => {
    await renderDialog(createRequest('prefix', '#12'));

    const dialog = getDialog();
    const textbox = dialog.getByRole('textbox', { name: 'Note' });

    await expect.element(dialog).toMatchTextContent(/Add a note to the message recorded/);
    await expect.element(textbox).toHaveValue('#12');
    await expect
      .element(textbox)
      .toHaveAccessibleDescription(`Message: ${isolate(`#12 ${DEFAULT_MESSAGE}`)}`);

    await textbox.fill('  ');

    await expect
      .element(textbox)
      .toHaveAccessibleDescription(`Message: ${isolate(DEFAULT_MESSAGE)}`);
  });

  test('previews a suffix', async () => {
    await renderDialog(createRequest('suffix'));

    const textbox = getDialog().getByRole('textbox', { name: 'Note' });

    await expect.element(textbox).toHaveValue('');
    await expect
      .element(textbox)
      .toHaveAccessibleDescription(`Message: ${isolate(DEFAULT_MESSAGE)}`);

    await textbox.fill('(#34)');

    await expect
      .element(textbox)
      .toHaveAccessibleDescription(`Message: ${isolate(`${DEFAULT_MESSAGE} (#34)`)}`);
  });

  test('answers with the text when OK is clicked', async () => {
    const request = createRequest(true);

    await renderDialog(request);
    await getDialog().getByRole('textbox').fill('Fix typos');
    await getDialog().getByRole('button', { name: 'OK' }).click();

    await vi.waitFor(() => expect(request.respond).toHaveBeenCalledWith('Fix typos'));
    expect(request.respond).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });

  test('cancels the request when Cancel is clicked', async () => {
    const request = createRequest('prefix');

    await renderDialog(request);
    await getDialog().getByRole('button', { name: 'Cancel' }).click();

    await vi.waitFor(() => expect(request.respond).toHaveBeenCalledWith(null));
    expect(request.respond).toHaveBeenCalledOnce();
  });

  test('cancels the request when Escape is pressed', async () => {
    const request = createRequest('suffix');

    await renderDialog(request);
    await expect.element(getDialog().getByRole('textbox')).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    await vi.waitFor(() => expect(request.respond).toHaveBeenCalledWith(null));
    expect(request.respond).toHaveBeenCalledOnce();
  });

  test('answers with the text when Enter is pressed, but not during IME composition', async () => {
    const request = createRequest('prefix');

    await renderDialog(request);

    const textbox = getDialog().getByRole('textbox');

    await textbox.fill('#56');

    const input = /** @type {HTMLInputElement} */ (textbox.element());

    // Confirming an IME conversion with Enter
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    );
    flushSync();
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    expect(request.respond).not.toHaveBeenCalled();
    await expect.element(getDialog()).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => expect(request.respond).toHaveBeenCalledWith('#56'));
    expect(request.respond).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
  });

  test('starts over with the initial value of a new request', async () => {
    await renderDialog(createRequest(true));

    const dialog = getDialog();

    await dialog.getByRole('textbox').fill('Edited');

    commitMessageRequest.current = createRequest('suffix', '#78');

    await expect.element(dialog.getByRole('textbox', { name: 'Note' })).toHaveValue('#78');
  });

  test('starts over after a cancellation, even with the same initial value', async () => {
    const request = createRequest('prefix');

    await renderDialog(request);
    await getDialog().getByRole('textbox').fill('#90');
    await getDialog().getByRole('button', { name: 'Cancel' }).click();
    await vi.waitFor(() => expect(request.respond).toHaveBeenCalledWith(null));
    await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();

    commitMessageRequest.current = createRequest('prefix');

    await expect.element(getDialog().getByRole('textbox', { name: 'Note' })).toHaveValue('');
  });
});
