/**
 * Spot anomalies in several metrics at once with an isolation forest.
 *
 * Rung N1. The robust threshold of N0 watches one metric at a time, and some
 * incidents are invisible that way: every metric stays inside its usual
 * range, and only the combination is impossible. Night-time traffic with
 * daytime errors is one such minute, and no single-series threshold will ever
 * ring for it.
 *
 * The forest cuts the space at random and measures how few cuts it takes to
 * leave a point on its own. A point in the middle of the crowd needs many; a
 * point out on its own needs three or four. There is nothing to label, and
 * the only real knob is the size of the forest.
 *
 * Written out in full rather than pulled from a library, because that is the
 * whole argument of this rung: the classical tool is small enough to read.
 * What it costs is the thing N0 was good at — the output is a rank between
 * zero and one, not a measured gap against a stated limit.
 */

/** Deterministic pseudo-random numbers: an alert that changes between two runs is not an alert. */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average depth of an unsuccessful search in a binary tree of n points. */
function averageDepth(n) {
  if (n <= 1) return 0;
  const EULER = 0.5772156649015329;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

/** One tree: cut on a random metric at a random value until the points are alone. */
function grow(rows, random, depth, maxDepth) {
  if (depth >= maxDepth || rows.length <= 1) return { size: rows.length };
  const metric = Math.floor(random() * rows[0].length);
  const values = rows.map((row) => row[metric]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return { size: rows.length };
  const cut = low + random() * (high - low);
  return {
    metric,
    cut,
    below: grow(rows.filter((row) => row[metric] < cut), random, depth + 1, maxDepth),
    above: grow(rows.filter((row) => row[metric] >= cut), random, depth + 1, maxDepth),
  };
}

/** How deep this row falls, plus what an unfinished leaf would still have cost. */
function depthOf(node, row, depth) {
  if (node.below === undefined) return depth + averageDepth(node.size);
  return depthOf(row[node.metric] < node.cut ? node.below : node.above, row, depth + 1);
}

/** A subsample without replacement, so every tree sees a different crowd. */
function subsample(rows, size, random) {
  const shuffled = [...rows];
  for (let i = 0; i < size; i += 1) {
    const j = i + Math.floor(random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}

/**
 * `rows` is one observation per minute, the metrics always in the same order.
 *
 * Nothing is labelled and nothing is scaled: the cuts are drawn between the
 * smallest and the largest value of each metric, so a metric counted in
 * milliseconds and one counted in requests weigh the same.
 */
export function train(rows, { trees = 100, seed = 0 } = {}) {
  const random = generator(seed);
  const size = Math.min(256, rows.length);
  const maxDepth = Math.ceil(Math.log2(size));
  const forest = [];
  for (let i = 0; i < trees; i += 1) {
    forest.push(grow(subsample(rows, size, random), random, 0, maxDepth));
  }
  return { forest, normaliser: averageDepth(size) };
}

/**
 * Between zero and one. Above one half, the point took fewer cuts to isolate
 * than the crowd did, which is the whole definition of an anomaly here.
 */
export function score(model, row) {
  const total = model.forest.reduce((sum, tree) => sum + depthOf(tree, row, 0), 0);
  return 2 ** (-total / model.forest.length / model.normaliser);
}

/**
 * The indices worth looking at, and the threshold is yours to set.
 *
 * Move it towards one to be woken up less often and miss more; towards zero
 * for the opposite trade. There is no value of it that turns the score into
 * an explanation.
 */
export function anomalies(model, rows, threshold = 0.6) {
  return rows.map((_, index) => index).filter((index) => score(model, rows[index]) > threshold);
}
