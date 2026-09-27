# End-to-end tests

These tests drive the whole app in Chromium with [Playwright](https://playwright.dev/): they sign in, browse, edit and save as a user would, and check the files the CMS writes. The unit and component tests mock the services around the code they test, so they can’t catch a flow that breaks between modules.

## Running

```bash
pnpm build      # the tests run against the production bundle in `package/dist`
pnpm test:e2e
pnpm test:e2e:ui  # Playwright’s UI mode, to watch and step through a test
```

To skip the build while working on a change, run the tests against the Vite dev server instead:

```bash
E2E_TARGET=dev pnpm test:e2e
```

The server listens on port 4180 and is started for each run. If the port is busy, e.g. because another worktree is running the tests at the same time, the run fails rather than test someone else’s server; set `E2E_PORT` to use another port.

## How it works

- `server.js` serves the admin page in `site/admin/` and the bundle under `/dist/`. With `E2E_TARGET=dev`, the dev server is used instead, with `VITE_SITE_URL` pointing at itself.
- Every test answers the request for `config.yml` with its own config: `BASE_CONFIG` from `fixtures/test.js` by default, or another one set with `test.use({ config })`, either as an object or a YAML string.
- The config uses the `test-repo` backend, which keeps the repository files in the origin private file system (OPFS). Each test runs in a fresh browser context, so it starts with an empty repository.
- The `cms` fixture opens the admin page (`open()`), writes files to the repository before sign-in (`seed()`, which takes a string or a `Buffer` for each file), signs in (`signIn()`) and reads the files back (`readRepo()` for text, `readRepoFile()` for a binary file), so a test can check what a Save actually wrote.
- To test a Git backend, use `GITHUB_CONFIG` and ask for the `github` fixture: a `MockGitHub` from `fixtures/github.js` answers the GitHub REST and GraphQL requests from an in-memory repository and stores a session, so the CMS signs in on its own when the page opens. Commit to it as a colleague with `github.commit(files)`, read the branch with `github.readFile(path)`, and check the commits the CMS sent in `github.received`. `github.beforeCommit` runs once when the CMS next commits, to move the branch under it. A request the mock can’t answer fails the test and is listed in the error; teach the mock to answer it.
- The CMS checks the repository for changes every minute, and when the window gets the focus back at least 10 seconds after the last check. Call `page.clock.install()` before opening the page, then `page.clock.fastForward()`, rather than waiting.
- `fixtures/configs/` holds larger configs with matching repository files to seed, e.g. `MONOLINGUAL_CONFIG` and `MONOLINGUAL_FILES`: a magazine site with most field types, a JSON collection referred to by a relation field, a file collection and a singleton. Their specs are in a folder of the same name under `specs/`. `FIELD_TYPES_CONFIG` covers the remaining field types and the list and object options, with specs in `specs/fields/`. `MEDIA_CONFIG` and `MEDIA_FILES` have images in several media folders — the global one, a collection’s own and one next to each entry — for the specs in `specs/assets/`.
- `createPNG()` from `fixtures/files.js` makes a real image to upload, which the CMS can decode for its thumbnail.

## Writing tests

- Name the files `specs/*.e2e.js`. Vitest ignores the `e2e` folder.
- Query by role and by the text a user sees, like the component tests do. Wait with web-first assertions (`await expect(locator).toBeVisible()`, `expect.poll()`), never with `waitForTimeout()`. The assertions retry for up to 5 seconds.
- An interpolated value in a label comes wrapped in bidi isolates, so match such a name with a regular expression: `getByRole('main', { name: /Posts.*Collection/ })`.
- Sveltia UI keeps closed dialogs and popups in the DOM with `inert`. Target the open one with `page.locator('dialog:not([inert])')`.
- Choose a menu item or a dropdown option with `cms.chooseMenuItem(trigger, item)`, and open a dropdown to type into with `cms.openPopup(trigger, popup)`. A Sveltia UI menu or listbox ignores input for 100 ms after it opens, so a click or key press right after it opens is lost. A list box that appears with a dialog, like those in the Select File dialog, does the same: click an option until it’s selected.
- The editor renders each field only once it’s scrolled into view, so a field further down doesn’t exist yet for a locator. For a config with many fields, use a tall viewport, e.g. `test.use({ viewport: { width: 1280, height: 6000 } })`, as `specs/fields/` does.
- A short `select` or `relation` field is shown as a radio group and a longer one as a combobox, a `number` field as a spinbutton and a `boolean` field as a switch. A list item is moved with its “Reorder Item” handle and the arrow keys. A radio’s label is its accessible name, not its text content.
- The rich text editor of a `markdown` or `richtext` field can’t be filled in: click it and type with `page.keyboard.type()`. The End key doesn’t move the caret on macOS, so set the selection in `evaluate()` to put the caret at the end. The editor picks up a selection made with the mouse only when the browser fires `selectionchange`, so a shortcut pressed right after a double-click can find nothing selected; `selectText()` in `rich-text.e2e.js` sets the selection and fires the event.
- Pin a known bug with a test that asserts the current behaviour, named with “(known issue)” and commented with the issue and what to expect once it’s fixed. The test fails when the bug is fixed, telling you to update it. Don’t use `test.fail()`: it also passes when the test breaks for an unrelated reason, e.g. a renamed button.
- The `{{year}}`, `{{month}}` and `{{day}}` slug tags come from the time of saving, so pin the clock with `page.clock.install({ time })` in a test that checks a file name.
- Optional fields missing from a file are written as empty values when the file is saved, unless `output.omit_empty_optional_fields` is on.
- Open an entry by clicking its row. Navigating to its hash URL doesn’t open the editor after sign-in.
- Upload a file with `setInputFiles()` on the hidden `input[type="file"]` inside the field group, or wait for the `filechooser` event when a button opens the file picker. A synthetic `drop` is ignored, as its files can’t be read as file system entries; drop files with `cms.dropFiles()`, which has the browser drag them in from disk. Give each uploaded file distinct content, e.g. another `createPNG()` colour. The same file twice opens the conflict dialog, which then intercepts every click.
- With i18n, the second pane shows the preview until a locale is picked from its “Switch Locale” radio group.
- If an interaction seems to be lost, e.g. a `fill()` that leaves the field empty, check what had the focus at that moment before adding a wait. A test that types faster than a user can still points at a real problem: the first test here found the “Create New Entry” button opening an empty popup that made the editor inert for a moment.
