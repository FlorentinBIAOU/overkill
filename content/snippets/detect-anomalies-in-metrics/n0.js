/**
 * Flag anomalies in a metric with a robust threshold on a sliding window.
 *
 * Rung N0. Median and median absolute deviation, no dependency, and a verdict
 * that can be read at three in the morning.
 *
 * The mean and the standard deviation are the wrong tools here. One incident
 * drags both, so a large enough spike widens the very band that was supposed
 * to catch it. The median and the median absolute deviation hold while
 * outliers fill less than half the window: the usual value stays among
 * ordinary values, and the tolerated gap widens as the outliers pile up
 * instead of jumping with the first one. That is the property an alert needs.
 *
 * Every verdict carries the numbers it was made of. "Anomaly at 03:12" leaves
 * whoever was woken up to reconstruct the reasoning before they can act;
 * "measured 4800, usual 1200, allowed up to 1511" is already half the
 * diagnosis, and it is the same three numbers the threshold itself used.
 *
 * One point over the limit is not an alert. On pure noise, one point in a
 * hundred to two in a hundred crosses the limit at the default settings: on a
 * metric sampled every minute that is ten to twenty pages a day, per metric,
 * for nothing. And a real step change crosses it for as many minutes as the
 * window takes to swallow it, which is a dozen pages for one incident.
 * `episodes` is what a pager should read: a run has to hold for `consecutive`
 * points before it counts, and an episode already open is not paged again.
 * `anomalies` stays, point by point, for a dashboard.
 */

// Scaling that puts the median absolute deviation on the same footing as a
// standard deviation for normally distributed data. Estimated on a short
// window it is noisy: pure Gaussian noise crosses 3.5 of these far more often
// than it crosses 3.5 true standard deviations, and the tests measure how often.
const NORMAL_SCALE = 1.4826;

/** Middle value, or the average of the two middle ones on an even count. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Judge every point against the `window` points that precede it.
 *
 * The first `window` points get no verdict at all. A point cannot be compared
 * with a history that does not exist yet, and saying nothing is more honest
 * than comparing it with a shorter, noisier window.
 *
 * `minSpread` is the smallest spread the metric may have, in its own unit. A
 * count that is zero most minutes, such as errors, has a median absolute
 * deviation of zero, and every single error would ring: pass 1 for it.
 *
 * Each verdict is the whole reasoning: the value, what the window called
 * usual, how far the value sat from it, and how far it was allowed to sit.
 */
export function scan(series, { window = 24, threshold = 3.5, minSpread = 0 } = {}) {
  if (!(window >= 1)) throw new RangeError('window must hold at least one point');
  const verdicts = [];
  for (let index = window; index < series.length; index += 1) {
    const reference = series.slice(index - window, index);
    const usual = median(reference);
    const spread = Math.max(NORMAL_SCALE * median(reference.map((value) => Math.abs(value - usual))), minSpread);
    const deviation = Math.abs(series[index] - usual);
    const limit = threshold * spread;
    verdicts.push({
      index,
      value: series[index],
      usual,
      deviation,
      limit,
      isAnomaly: deviation > limit,
    });
  }
  return verdicts;
}

/**
 * Every point over the limit, each one still carrying its numbers.
 *
 * This is the dashboard view, not the pager view: at the default settings a
 * healthy metric puts one point in a hundred here. `episodes` is the pager
 * view.
 */
export function anomalies(series, options = {}) {
  return scan(series, options).filter((verdict) => verdict.isAnomaly);
}

/**
 * What a pager should see: one entry per run of points over the limit.
 *
 * Two rules, and they are the ones every on-call rota ends up adding. A run has
 * to hold for `consecutive` points before it counts, which is what keeps the
 * noise of a healthy metric off the phone. And a run is reported once, not once
 * per minute, which is what keeps one step change from paging a dozen times.
 *
 * `consecutive: 1` covers every point of `anomalies`, runs of them grouped into
 * one episode each.
 *
 * Each episode carries `start`, `length`, the verdict that `openedBy` it and
 * the `worst` point of the run, with the numbers that judged them.
 */
export function episodes(series, options = {}) {
  const { consecutive = 3, ...rest } = options;
  if (consecutive < 1) throw new RangeError('consecutive must be at least one point');
  const found = [];
  let run = [];
  const close = () => {
    if (run.length >= consecutive) {
      const worst = run.reduce((a, b) => (b.deviation - b.limit > a.deviation - a.limit ? b : a));
      found.push({ start: run[0].index, length: run.length, openedBy: run[0], worst });
    }
    run = [];
  };
  for (const verdict of scan(series, rest)) {
    if (verdict.isAnomaly) run.push(verdict);
    else close();
  }
  close();
  return found;
}
