/**
 * Route a ticket with TF-IDF and a linear classifier trained on the archive.
 *
 * Rung N1. The keyword rules of N0 know the words someone thought of. This
 * knows the words the desk actually received: it is trained on the tickets the
 * teams have already answered, so the vocabulary of the customers, not the
 * vocabulary of the rule writer, decides.
 *
 * Written out rather than pulled from a library, because TF-IDF and a softmax
 * regression are sixty lines. The model is a table of weights: small enough to
 * keep beside the code, retrained while you read this, and every weight can be
 * printed and argued about when someone asks why their ticket moved.
 *
 * What it keeps from N0, deliberately: a default team. A classifier always
 * returns something, and its most likely class on a ticket it has no opinion
 * about is still a class. The confidence floor is what turns that shrug back
 * into the default queue, instead of a wrong queue.
 */

export const DEFAULT_TEAM = 'general';

/** Words of a ticket, lowercased and stripped of accents. */
function tokens(text) {
  const folded = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const words = folded.match(/[\p{L}\p{N}]+/gu) ?? [];
  // Word pairs as well as single words, because "mot de passe" and "en
  // retard" carry more than the words they are made of.
  return words.concat(words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`));
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

/** One TF-IDF row, brought to length one. Unknown terms are simply dropped. */
function vector(vocabulary, ticket) {
  const counts = new Map();
  for (const term of tokens(ticket)) {
    const j = vocabulary.terms.get(term);
    if (j !== undefined) counts.set(j, (counts.get(j) ?? 0) + 1);
  }
  const row = new Float64Array(vocabulary.idf.length);
  // Sublinear term frequency: a word repeated ten times is not ten times the
  // signal, and an angry customer repeats words.
  for (const [j, count] of counts) row[j] = (1 + Math.log(count)) * vocabulary.idf[j];
  const norm = Math.hypot(...row);
  if (norm) for (const [j] of counts) row[j] /= norm;
  return row;
}

/** Softmax over the teams: one score per team, summing to one. */
function scores(model, row) {
  const raw = model.classes.map((_, c) => {
    let z = model.bias[c];
    for (let j = 0; j < row.length; j += 1) z += model.weights[c][j] * row[j];
    return z;
  });
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
export function train(tickets, teams, { epochs = 300, rate = 1 } = {}) {
  const vocabulary = fitVocabulary(tickets);
  const classes = [...new Set(teams)].sort();
  const rows = tickets.map((t) => vector(vocabulary, t));
  const share = new Map(classes.map((c) => [c, teams.filter((t) => t === c).length]));
  const model = {
    vocabulary,
    classes,
    weights: classes.map(() => new Float64Array(vocabulary.idf.length)),
    bias: new Float64Array(classes.length),
  };
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      const predicted = scores(model, rows[i]);
      const step = (rate * teams.length) / (classes.length * share.get(teams[i]));
      for (let c = 0; c < classes.length; c += 1) {
        const error = predicted[c] - (teams[i] === classes[c] ? 1 : 0);
        for (let j = 0; j < rows[i].length; j += 1) model.weights[c][j] -= step * error * rows[i][j];
        model.bias[c] -= step * error;
      }
    }
  }
  return model;
}

/**
 * Every team with the probability the model gives it, best first.
 *
 * A support desk needs the runner-up: two teams at almost the same score is
 * exactly the ambiguous ticket of N0, and here it is visible instead of being
 * silently resolved by a priority order.
 */
export function rank(model, ticket) {
  const probabilities = scores(model, vector(model.vocabulary, ticket));
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
