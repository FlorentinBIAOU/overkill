/**
 * Flag anomalies in a metric with a robust threshold on a sliding window.
 *
 * Rung N0. Median and median absolute deviation, no dependency, and a verdict
 * that can be read at three in the morning.
 *
 * The mean and the standard deviation are the wrong tools here. One incident
 * drags both, so a large enough spike widens the very band that was supposed
 * to catch it. The median and the median absolute deviation ignore up to half
 * the window, which is exactly the property an alert needs.
 *
 * Every verdict carries the numbers it was made of. "Anomaly at 03:12" leaves
 * whoever was woken up to reconstruct the reasoning before they can act;
 * "measured 4800, usual 1200, allowed up to 1511" is already half the
 * diagnosis, and it is the same three numbers the threshold itself used.
 */

// Scaling that puts the median absolute deviation on the same footing as a
// standard deviation for normally distributed data, so that a threshold of
// 3.5 keeps the meaning it has everywhere else.
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
 * Each verdict is the whole reasoning: the value, what the window called
 * usual, how far the value sat from it, and how far it was allowed to sit.
 */
export function scan(series, { window = 24, threshold = 3.5 } = {}) {
  const verdicts = [];
  for (let index = window; index < series.length; index += 1) {
    const reference = series.slice(index - window, index);
    const usual = median(reference);
    const spread = NORMAL_SCALE * median(reference.map((value) => Math.abs(value - usual)));
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

/** The subset a pager should see, each one still carrying its numbers. */
export function anomalies(series, options = {}) {
  return scan(series, options).filter((verdict) => verdict.isAnomaly);
}
