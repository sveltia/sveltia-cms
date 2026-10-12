# Benchmarks

These scenarios time what a user waits for on a large site: loading it, typing in a deeply nested entry, scrolling and sorting a long entry list, and opening a big media folder. They drive the production bundle in Chromium with [Playwright](https://playwright.dev/), like the [end-to-end tests](../e2e/README.md), whose server, fixtures and GitHub mock they reuse. They’re not run in CI: timings depend on the machine, so compare runs made on the same one.

## Running

```bash
pnpm build      # the benchmarks run against the production bundle in `package/dist`
pnpm bench      # every scenario; add a file name, e.g. `pnpm bench editor`, to run one
```

Each scenario runs 3 times, in a fresh browser context each time, and reports the median along with every run’s value. The results are printed and written to `bench-results/latest/`, one JSON file per scenario.

To judge a change, keep the results of a run before it, then compare:

```bash
cp -R bench-results/latest bench-results/baseline
pnpm bench
pnpm bench:compare bench-results/baseline
```

A change of less than 10%, or under 5 ms, is left unmarked as noise. Close other apps while the benchmarks run, and run a scenario again if one result looks off.

Environment variables:

- `BENCH_RUNS`: number of runs of each scenario. Default: 3.
- `BENCH_ENTRIES`: number of posts in the large blog. Default: 5000.
- `BENCH_ASSETS`: number of images in the media folder. Default: 300.
- `BENCH_OUT`: folder to write the results to. Default: `bench-results/latest`.
- `BENCH_PORT`: port of the server. Default: 4190, away from the end-to-end tests’ 4180.

## Scenarios

- `load.bench.js`: loading the blog from a mocked GitHub repository, cold (nothing cached) and warm (reloaded once the file cache has been written), and from the `test-repo` local repository. The load ends when the first row of the entry list is shown.
- `editor.bench.js`: opening a page with 30 sections, each with lists and objects nested up to four levels, then typing into its Title field, which a Compute field depends on, and into a field four levels down. Each keystroke is timed from `keydown` to the end of the frame painted after it. The fields are only rendered once scrolled into view, so the Title field is typed into again after scrolling through the whole entry.
- `list.bench.js`: showing the blog’s 5,000 posts, scrolling to the end of the list with the mouse wheel while recording the time between frames, and sorting the list by date.
- `assets.bench.js`: opening the Asset Library with 300 images of 1200 × 800 pixels, timing until every thumbnail on screen is shown, first when they’re generated and then from the cache after a reload.

Every scenario also reports the total of the long tasks, those that blocked the main thread for 50 ms or more, during the step it times.

## Writing scenarios

- Put a scenario in `specs/*.bench.js`, and open the CMS with `openSession()` from `fixtures/session.js`, which creates a fresh browser context with the site from `fixtures/sites.js`.
- Record values with a `Results` from `fixtures/measure.js`, and call `save()` once all the runs are done. Time a step in the page with `now()` and `timeUntil()`, which use the page’s clock rather than Playwright’s, so the round trips to the browser aren’t counted.
- The editor renders a field only once it’s scrolled into view, so scroll to a field before using it, as `scrollUntilRendered()` in `editor.bench.js` does. An action fails after 30 seconds rather than waiting for good.
