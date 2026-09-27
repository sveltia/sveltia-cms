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
- The `cms` fixture opens the admin page (`open()`), writes files to the repository before sign-in (`seed()`), signs in (`signIn()`) and reads the files back (`readRepo()` for text, `readRepoFile()` for a binary file), so a test can check what a Save actually wrote.
- To test a Git backend, use `GITHUB_CONFIG` and ask for the `github` fixture: a `MockGitHub` from `fixtures/github.js` answers the GitHub REST and GraphQL requests from an in-memory repository and stores a session, so the CMS signs in on its own when the page opens. Commit to it as a colleague with `github.commit(files)`, read the branch with `github.readFile(path)`, and check the commits the CMS sent in `github.received`. `github.beforeCommit` runs once when the CMS next commits, to move the branch under it. A request the mock can’t answer fails the test and is listed in the error; teach the mock to answer it.
- The CMS checks the repository for changes every minute, and when the window gets the focus back at least 10 seconds after the last check. Call `page.clock.install()` before opening the page, then `page.clock.fastForward()`, rather than waiting.
- `createPNG()` from `fixtures/files.js` makes a real image to upload, which the CMS can decode for its thumbnail.

## Writing tests

- Name the files `specs/*.e2e.js`. Vitest ignores the `e2e` folder.
- Query by role and by the text a user sees, like the component tests do. Wait with web-first assertions (`await expect(locator).toBeVisible()`, `expect.poll()`), never with `waitForTimeout()`. The assertions retry for up to 5 seconds.
- An interpolated value in a label comes wrapped in bidi isolates, so match such a name with a regular expression: `getByRole('main', { name: /Posts.*Collection/ })`.
- Sveltia UI keeps closed dialogs and popups in the DOM with `inert`. Target the open one with `page.locator('dialog:not([inert])')`.
- Open an entry by clicking its row. Navigating to its hash URL doesn’t open the editor after sign-in.
- Upload a file with `setInputFiles()` on the hidden `input[type="file"]` inside the field group; a synthetic `drop` is ignored. Give each uploaded file distinct content, e.g. another `createPNG()` colour. The same file twice opens the conflict dialog, which then intercepts every click.
- With i18n, the second pane shows the preview until a locale is picked from its “Switch Locale” radio group.
- If an interaction seems to be lost, e.g. a `fill()` that leaves the field empty, check what had the focus at that moment before adding a wait. A test that types faster than a user can still points at a real problem: the first test here found the “Create New Entry” button opening an empty popup that made the editor inert for a moment.
