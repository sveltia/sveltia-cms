import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * A metric measured over several runs.
 * @typedef {object} Metric
 * @property {string} name Metric name, e.g. `cold load`.
 * @property {string} unit Unit, e.g. `ms`.
 * @property {number[]} values Value of each run.
 */

/**
 * Number of times each scenario is run. The median of the runs is reported, which keeps a run
 * slowed down by something else on the machine from skewing the result.
 */
export const RUNS = Number(process.env.BENCH_RUNS ?? 3);

/**
 * Folder the results are written to, one JSON file per scenario.
 */
export const OUT_DIR = path.resolve(process.env.BENCH_OUT ?? 'bench-results/latest');

/**
 * Get the median of the given values.
 * @param {number[]} values Values.
 * @returns {number} Median.
 */
export const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Get the given percentile of the values.
 * @param {number[]} values Values.
 * @param {number} rank Percentile, between 0 and 100.
 * @returns {number} Value, or `0` if there are none.
 */
export const percentile = (values, rank) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.ceil((rank / 100) * sorted.length) - 1)];
};

/**
 * Collects the metrics of a scenario, and writes them to {@link OUT_DIR} once it’s done.
 */
export class Results {
  /**
   * Create a result set for a scenario.
   * @param {string} scenario Scenario name, used as the file name, e.g. `load`.
   * @param {Record<string, any>} [params] Parameters of the scenario, e.g. the number of entries,
   * recorded so results of different sizes aren’t compared by mistake.
   */
  constructor(scenario, params = {}) {
    this.scenario = scenario;
    this.params = params;
    /** @type {Map<string, Metric>} */
    this.metrics = new Map();
  }

  /**
   * Add the value of a metric for a run.
   * @param {string} name Metric name.
   * @param {number} value Value.
   * @param {string} [unit] Unit.
   */
  add(name, value, unit = 'ms') {
    const metric = this.metrics.get(name) ?? { name, unit, values: [] };

    metric.values.push(Math.round(value * 10) / 10);
    this.metrics.set(name, metric);
  }

  /**
   * Write the results to {@link OUT_DIR} and print a summary.
   */
  async save() {
    const metrics = [...this.metrics.values()].map((metric) => ({
      ...metric,
      median: median(metric.values),
    }));

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(
      path.join(OUT_DIR, `${this.scenario}.json`),
      `${JSON.stringify({ scenario: this.scenario, params: this.params, metrics }, null, 2)}\n`,
    );

    // eslint-disable-next-line no-console
    console.log(
      [
        `\n${this.scenario} ${JSON.stringify(this.params)}`,
        ...metrics.map(
          ({ name, unit, values, median: value }) =>
            `  ${name.padEnd(36)} ${String(value).padStart(9)} ${unit.padEnd(6)} (${values.join(', ')})`,
        ),
      ].join('\n'),
    );
  }
}

/**
 * Script run in the page before the CMS, recording the long tasks: those that block the main thread
 * for 50 ms or more. A scenario can then tell how long the page was unresponsive.
 */
const OBSERVER_SCRIPT = () => {
  /** @type {any} */
  const bench = { longTasks: [] };

  // @ts-ignore
  window.__bench = bench;

  new PerformanceObserver((list) => {
    list.getEntries().forEach(({ startTime, duration }) => {
      bench.longTasks.push({ startTime, duration });
    });
  }).observe({ type: 'longtask', buffered: true });
};

/**
 * Start recording the long tasks in every page of the page’s browser context.
 * @param {Page} page Page.
 */
export const observeLongTasks = async (page) => {
  await page.context().addInitScript(OBSERVER_SCRIPT);
};

/**
 * Get the total and the longest of the long tasks recorded since the given time.
 * @param {Page} page Page.
 * @param {number} [since] Time since the navigation started, in milliseconds.
 * @returns {Promise<{ total: number, longest: number, count: number }>} Long tasks.
 */
export const getLongTasks = async (page, since = 0) =>
  page.evaluate((_since) => {
    // @ts-ignore
    const tasks = /** @type {{ startTime: number, duration: number }[]} */ (
      window.__bench.longTasks
    ).filter(({ startTime }) => startTime >= _since);

    return {
      total: tasks.reduce((sum, { duration }) => sum + duration, 0),
      longest: Math.max(0, ...tasks.map(({ duration }) => duration)),
      count: tasks.length,
    };
  }, since);

/**
 * Get the time elapsed since the page’s navigation started, in milliseconds.
 * @param {Page} page Page.
 * @returns {Promise<number>} Time.
 */
export const now = async (page) => page.evaluate(() => performance.now());

/**
 * Wait until the given element is in the page, and get the time it was found, since the
 * navigation started. The page is checked on every animation frame, so the time is accurate to a
 * frame.
 * @param {Page} page Page.
 * @param {string} selector CSS selector.
 * @param {number} [timeout] Timeout in milliseconds.
 * @returns {Promise<number>} Time.
 */
export const timeUntil = async (page, selector, timeout = 120_000) => {
  const handle = await page.waitForFunction(
    (_selector) => (document.querySelector(_selector) ? performance.now() : undefined),
    selector,
    { polling: 'raf', timeout },
  );

  return /** @type {number} */ (await handle.jsonValue());
};

/**
 * Start measuring how long each keystroke takes to show on screen: from the `keydown` event to the
 * frame painted after it, which is what a user waits for while typing.
 * @param {Page} page Page.
 */
export const startKeystrokeTimer = async (page) => {
  await page.evaluate(() => {
    /** @type {number[]} */
    const latencies = [];

    // @ts-ignore
    window.__keystrokes = latencies;

    document.addEventListener(
      'keydown',
      () => {
        const start = performance.now();

        // The callback of the next frame runs before it’s painted; a message posted from there is
        // delivered once the frame is done
        requestAnimationFrame(() => {
          const { port1, port2 } = new MessageChannel();

          port1.addEventListener('message', () => {
            latencies.push(performance.now() - start);
          });
          port1.start();

          port2.postMessage(undefined);
        });
      },
      { capture: true },
    );
  });
};

/**
 * Get the keystroke latencies measured since {@link startKeystrokeTimer} was called.
 * @param {Page} page Page.
 * @returns {Promise<number[]>} Latency of each keystroke in milliseconds.
 */
export const getKeystrokeLatencies = async (page) =>
  // @ts-ignore
  page.evaluate(() => [...window.__keystrokes]);

/**
 * Start recording the time between animation frames, to tell how smooth an interaction like
 * scrolling is.
 * @param {Page} page Page.
 */
export const startFrameTimer = async (page) => {
  await page.evaluate(() => {
    /** @type {number[]} */
    const gaps = [];
    let last = performance.now();

    // @ts-ignore
    window.__frames = { gaps, running: true };

    /**
     * Record the time since the previous frame.
     * @param {number} time Frame time.
     */
    const tick = (time) => {
      gaps.push(time - last);
      last = time;

      // @ts-ignore
      if (window.__frames.running) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  });
};

/**
 * Stop recording the frames, and get the time between them.
 * @param {Page} page Page.
 * @returns {Promise<number[]>} Time between consecutive frames, in milliseconds.
 */
export const stopFrameTimer = async (page) =>
  page.evaluate(() => {
    // @ts-ignore
    window.__frames.running = false;

    // @ts-ignore
    return [...window.__frames.gaps];
  });

/**
 * Whether to record a CPU profile of the steps wrapped in {@link profile}. Set `BENCH_PROFILE=1`,
 * then summarize a profile with `pnpm bench:profile <file>`.
 */
export const PROFILE = !!process.env.BENCH_PROFILE;

/**
 * Run a step, recording a CPU profile of it if {@link PROFILE} is set. The profile is written to
 * the `profiles` folder of {@link OUT_DIR}, and can also be opened in the Performance panel of the
 * Chrome DevTools.
 * @template T
 * @param {Page} page Page.
 * @param {string} name Profile name, used as the file name, e.g. `list-sort`.
 * @param {() => Promise<T>} step Step.
 * @returns {Promise<T>} What the step returns.
 */
export const profile = async (page, name, step) => {
  if (!PROFILE) {
    return step();
  }

  const cdp = await page.context().newCDPSession(page);

  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');

  try {
    return await step();
  } finally {
    const { profile: cpuProfile } = await cdp.send('Profiler.stop');
    const dir = path.join(OUT_DIR, 'profiles');

    await cdp.detach();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${name}.cpuprofile`), JSON.stringify(cpuProfile));
  }
};
