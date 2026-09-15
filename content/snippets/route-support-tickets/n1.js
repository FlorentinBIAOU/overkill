/**
 * Route a ticket with TF-IDF and a linear classifier trained on the archive.
 *
 * Rung N1. The keyword rules of N0 know the words someone thought of. This
 * knows the words the desk actually received: it is trained on the tickets the
 * teams have already answered, so the vocabulary of the customers, not the
 * vocabulary of the rule writer, decides.
 *
 * Written out rather than pulled from a library, and written to learn what the
 * Python snippet learns with scikit-learn: the same words and word pairs, the
 * same TF-IDF weighting, the same penalised objective. The model is a table of
 * weights, and every weight can be printed and argued about when someone asks
 * why their ticket moved.
 *
 * What it keeps from N0, deliberately: a default team. A classifier always
 * returns something, and its most likely class on a ticket it has no opinion
 * about is still a class. The confidence floor is what turns that shrug back
 * into the default queue, instead of a wrong queue.
 */

export const DEFAULT_TEAM = 'general';

// The penalty, as scikit-learn's C: the same value as the Python snippet.
const C = 10;

/** Words of a ticket, lowercased and stripped of accents. */
function tokens(text) {
  const folded = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  // Two characters or more, as scikit-learn's default token pattern.
  const words = folded.match(/[\p{L}\p{N}_]{2,}/gu) ?? [];
  // Word pairs as well as single words, because "mot de passe" and "en
  // retard" carry more than the words they are made of.
  return words.concat(words.slice(1).map((w, i) => `${words[i]} ${w}`));
}

/** Vocabulary and inverse document frequency, learnt from the archive alone. */
function fitVocabulary(tickets) {
  const seen = new Map();
  for (const ticket of tickets) {
    for (const term of new Set(tokens(ticket))) seen.set(term, (seen.get(term) ?? 0) + 1);
  }
  const terms = new Map();
  const idf = [];
  for (const [term, documents] of seen) {
    terms.set(term, idf.length);
    idf.push(Math.log((1 + tickets.length) / (1 + documents)) + 1);
  }
  return { terms, idf };
}

/** One TF-IDF row, as [term, value] pairs, brought to length one. Unknown terms are dropped. */
function vector(vocabulary, ticket) {
  const counts = new Map();
  for (const term of tokens(ticket)) {
    const j = vocabulary.terms.get(term);
    if (j !== undefined) counts.set(j, (counts.get(j) ?? 0) + 1);
  }
  // Sublinear term frequency: a word repeated ten times is not ten times the
  // signal, and an angry customer repeats words.
  const row = [...counts].map(([j, count]) => [j, (1 + Math.log(count)) * vocabulary.idf[j]]);
  const norm = Math.sqrt(row.reduce((sum, [, v]) => sum + v * v, 0));
  return norm ? row.map(([j, v]) => [j, v / norm]) : row;
}

/** Softmax over the teams: one score per team, summing to one. */
function softmax(theta, width, classes, row) {
  const raw = classes.map((_, c) => row.reduce((z, [j, v]) => z + theta[c * width + j] * v, theta[c * width + width - 1]));
  const top = Math.max(...raw);
  const exponentials = raw.map((z) => Math.exp(z - top));
  const total = exponentials.reduce((a, b) => a + b, 0);
  return exponentials.map((e) => e / total);
}

/**
 * `teams` is the team that actually handled each past ticket.
 *
 * Each example is weighted by the rarity of its team: an archive is never
 * balanced, and an unweighted model learns to answer the busiest team.
 */
export function train(tickets, teams) {
  const classes = [...new Set(teams)].sort();
  if (classes.length < 2 || tickets.length !== teams.length) {
    throw new RangeError('the archive needs one team per ticket, and at least two teams');
  }
  const vocabulary = fitVocabulary(tickets);
  const rows = tickets.map((t) => vector(vocabulary, t));
  const width = vocabulary.idf.length + 1; // the weights of one team, then its bias
  const labels = teams.map((t) => classes.indexOf(t));
  const weight = labels.map((l) => tickets.length / (classes.length * labels.filter((m) => m === l).length));

  // Minimise the weighted cross-entropy plus |W|² / 2C, scikit-learn's
  // objective, by accelerated gradient descent. Each weight gets its own step,
  // from a bound on its curvature, so no learning rate needs tuning.
  const size = classes.length * width;
  const bound = new Float64Array(width);
  rows.forEach((row, i) => {
    const spread = 1 + row.reduce((sum, [, v]) => sum + Math.abs(v), 0);
    bound[width - 1] += 0.5 * weight[i] * spread;
    for (const [j, v] of row) bound[j] += 0.5 * weight[i] * Math.abs(v) * spread;
  });
  for (let j = 0; j < width - 1; j += 1) bound[j] += 1 / C;
  let theta = new Float64Array(size);
  let previous = theta;
  for (let step = 0, k = 0; step < 20000; step += 1, k += 1) {
    const momentum = k / (k + 3);
    const ahead = theta.map((t, n) => t + momentum * (t - previous[n]));
    const gradient = ahead.map((t, n) => (n % width === width - 1 ? 0 : t / C));
    rows.forEach((row, i) => {
      softmax(ahead, width, classes, row).forEach((p, c) => {
        const error = weight[i] * (p - (labels[i] === c ? 1 : 0));
        gradient[c * width + width - 1] += error;
        for (const [j, v] of row) gradient[c * width + j] += error * v;
      });
    });
    const next = ahead.map((t, n) => t - gradient[n] / bound[n % width]);
    // Restart the momentum when it points uphill.
    let uphill = 0;
    for (let n = 0; n < size; n += 1) uphill += gradient[n] * (next[n] - theta[n]);
    if (uphill > 0) k = 0;
    previous = theta;
    theta = next;
    if (gradient.every((g) => Math.abs(g) < 1e-6)) break;
  }
  return { vocabulary, classes, width, theta };
}

/**
 * Every team with the probability the model gives it, best first.
 *
 * A support desk needs the runner-up: two teams at almost the same score is
 * exactly the ambiguous ticket of N0, and here it is visible instead of being
 * silently resolved by a priority order.
 */
export function rank(model, ticket) {
  const probabilities = softmax(model.theta, model.width, model.classes, vector(model.vocabulary, ticket));
  return model.classes
    .map((team, c) => [team, probabilities[c]])
    .sort((a, b) => b[1] - a[1]);
}

/**
 * The team that gets the ticket, or the default queue below the floor.
 *
 * The floor is yours to set. Raise it and more tickets are read by a human
 * before they move; lower it and more tickets are moved on a hunch. Nothing in
 * the model can make that choice for you.
 */
export function route(model, ticket, { minConfidence = 0.5, defaultTeam = DEFAULT_TEAM } = {}) {
  const [team, confidence] = rank(model, ticket)[0];
  return confidence >= minConfidence ? team : defaultTeam;
}
