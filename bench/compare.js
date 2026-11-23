/* eslint-disable no-console */

/**
 * Compare the results of two benchmark runs, scenario by scenario, and print the change in the
 * median of each metric.
 *
 * Usage: node bench/compare.js <baseline folder> [results folder]. The results folder defaults to
 * `bench-results/latest`, where `pnpm bench` writes.
 */

import { readdir, readFile } from 'fs/promises';
import path from 'path';

const [baselineDir, resultsDir = 'bench-results/latest'] = process.argv.slice(2);

if (!baselineDir) {
  console.error('Usage: node bench/compare.js <baseline folder> [results folder]');
  process.exit(1);
}

/**
 * Change below which a difference is taken as noise, as a ratio of the baseline.
 */
const NOISE = 0.1;

/**
 * Read the results in a folder, keyed by scenario.
 * @param {string} dir Folder.
 * @returns {Promise<Map<string, any>>} Results.
 */
const readResults = async (dir) => {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));

  return new Map(
    await Promise.all(
      files.map(async (name) => {
        const result = JSON.parse(await readFile(path.join(dir, name), 'utf8'));

        return /** @type {[string, any]} */ ([result.scenario, result]);
      }),
    ),
  );
};

const baseline = await readResults(baselineDir);
const results = await readResults(resultsDir);

results.forEach(({ scenario, params, metrics }) => {
  const base = baseline.get(scenario);

  console.log(`\n${scenario} ${JSON.stringify(params)}`);

  if (!base) {
    console.log('  (no baseline)');

    return;
  }

  if (JSON.stringify(base.params) !== JSON.stringify(params)) {
    console.log(`  Note: the baseline was run with ${JSON.stringify(base.params)}`);
  }

  /** @type {Map<string, any>} */
  const baseMetrics = new Map(base.metrics.map((/** @type {any} */ m) => [m.name, m]));

  metrics.forEach(({ name, unit, median }) => {
    const before = baseMetrics.get(name)?.median;

    if (before === undefined) {
      console.log(`  ${name.padEnd(48)} ${String(median).padStart(9)} ${unit} (new)`);

      return;
    }

    const ratio = before ? (median - before) / before : 0;
    const sign = ratio > 0 ? '+' : '';

    const verdict =
      Math.abs(ratio) < NOISE || Math.abs(median - before) < 5
        ? ''
        : ratio < 0
          ? '  faster'
          : '  SLOWER';

    console.log(
      `  ${name.padEnd(48)} ${String(before).padStart(9)} → ${String(median).padStart(9)} ${unit}` +
        ` (${sign}${Math.round(ratio * 100)}%)${verdict}`,
    );
  });
});
