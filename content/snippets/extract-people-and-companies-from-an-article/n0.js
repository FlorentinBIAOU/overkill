/**
 * The proper names an article carries, typed only where something proves the type.
 *
 * Rung N0. In French as in English a proper name is capitalised, so finding
 * the candidates is a scan. Saying what each one *is* — a person, a company, a
 * place — is the hard half, and nothing in the letters themselves says it:
 * « Boulanger » is a family name and a chain of shops, « Orange » is a company
 * and a fruit, « Lyon » is a city and a surname.
 *
 * So this rung types a name only when the sentence proves it. « M. » or
 * « Mme » before it proves a person; a legal form such as « SARL » or « Ltd »
 * after it, or « la société » before it, proves a company. Everything else
 * comes back as `unknown`, which is what the sentence actually supports.
 * Guessing from the shape of the word is how « Boulanger a livré le colis »
 * becomes a bakery.
 *
 * Two limits are counted rather than hidden. A single capitalised word opening
 * a sentence is not returned, because most of them are just the first word of
 * the sentence; `skipped_at_sentence_start` says how many were passed over.
 * And the markers below are French and English ones: they are a declared list,
 * they are meant to be extended, and a text that carries none of them comes
 * back entirely `unknown`.
 */

// What proves a person, before the name.
export const HONORIFICS = new Set(['m', 'm.', 'mme', 'mlle', 'dr', 'dr.', 'me', 'pr',
  'prof', 'prof.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'sir']);

// What proves a company, after the name.
export const LEGAL_FORMS = new Set(['sarl', 'sas', 'sasu', 'sa', 'snc', 'sci', 'eurl',
  'scop', 'gie', 'gmbh', 'ag', 'ltd', 'ltd.', 'inc', 'inc.', 'llc', 'plc', 'bv', 'nv', 'spa']);

// What proves a company, before the name. Two words at most, lowercase.
const ORG_LEADS = new Set(['la société', 'l entreprise', 'le groupe', 'la marque',
  'the company', 'the firm', 'the group', 'l enseigne']);

// Lowercase words a name may contain without being cut: « Jean de La Fontaine »,
// « Ludwig van Beethoven », « Banque de France ». « et » and « and » are
// deliberately absent, although « Marks and Spencer » wants them: keeping them
// merges « Alex Ferguson et Acme » into a single name, and inventing one entity
// out of two is worse than returning one name in two pieces.
export const PARTICLES = new Set(['de', 'du', 'des', 'da', 'della', 'van', 'von',
  'der', 'den', 'ten', 'of', 'la', 'le', 'les', 'el', 'al', 'd', 'l', 'o']);

// A word, with neither full stop nor apostrophe inside it. « M. » is therefore
// the token « M » followed by a separator, which keeps an honorific out of the
// name, and « L'enseigne » is two tokens, which keeps the article out of it.
const WORD = /\p{L}[\p{L}\p{N}_-]*/gu;

// Words that open a sentence and are never part of a name. A capitalised run
// that starts a sentence with one of them starts one word later: « Après
// Renault » is Renault, « Selon Le Monde » is Le Monde. The list is declared
// rather than inferred, like HONORIFICS and LEGAL_FORMS, because a rung that
// guessed which openers are names would be guessing exactly what it says it
// will not — and it is meant to be extended.
//
// Articles and particles are deliberately absent from it: « Le Monde » opens a
// sentence with « Le », and dropping that word would lose the newspaper.
export const SENTENCE_OPENERS = new Set([
  'après', 'avant', 'selon', 'depuis', 'chez', 'pour', 'contre', 'malgré',
  'dès', 'lors', 'entre', 'face', 'sans', 'sous', 'sur', 'dans', 'avec',
  'par', 'vers', 'pendant', 'durant', 'outre', 'parmi', 'quant', 'comme',
  'alors', 'ainsi', 'aussi', 'cependant', 'pourtant', 'toutefois', 'enfin',
  'ensuite', 'puis', 'donc', 'mais', 'car', 'quand', 'lorsque',
  'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs',
  'notre', 'votre', 'nos', 'vos', 'mon', 'ma', 'mes',
  'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous',
  'after', 'before', 'since', 'according', 'despite', 'during', 'among',
  'between', 'through', 'under', 'over', 'about', 'against', 'within',
  'without', 'across', 'around', 'because', 'although', 'however',
  'therefore', 'meanwhile', 'instead', 'finally', 'then', 'when', 'while',
  'where', 'this', 'these', 'that', 'those', 'their', 'his', 'her', 'its',
  'our', 'your', 'but', 'and', 'for', 'nor', 'yet', 'with', 'from',
]);

// What two words of one name may be separated by: a space, or the apostrophe
// French elides on — « Jean d'Artagnan » is one name.
const JOINS = /^([ \t\r\n\f\v  ]+|['’])$/;
const SENTENCE_END = /[.!?…:;\n\r]\s*$/;
const UPPER = /^\p{Lu}/u;

/**
 * The proper names of `text`, each with what the sentence proves about it.
 *
 * `type` is « person », « company » or « unknown », and `evidence` says what
 * proved it. A name with no evidence is never typed by its spelling.
 *
 * `skipped_at_sentence_start` counts the capitalised words this rung set aside
 * because they open a sentence: a word alone, which it cannot tell from a
 * name, and the opener in front of a name — « Après » in « Après Renault ».
 *
 * What this rung has no way to recognise at all is what a name is *of*: a
 * product reference like « A350 » in « Airbus a livré son premier A350 » is
 * capitalised, follows no opener and carries no evidence, so it comes back as
 * an `unknown` name. That is a rung above.
 */
export function extractNames(text) {
  if (typeof text !== 'string') {
    return { names: [], skipped_at_sentence_start: 0, reason: `expected text, not ${typeof text}` };
  }

  const tokens = [...text.matchAll(WORD)]
    .map((m) => [m[0], m.index, m.index + m[0].length]);
  const names = [];
  let skipped = 0;
  let index = 0;
  while (index < tokens.length) {
    const length = runLength(tokens, index, text);
    if (length === 0) {
      index += 1;
      continue;
    }
    let start = tokens[index][1];
    const end = tokens[index + length - 1][2];
    const opens = index === 0 || SENTENCE_END.test(text.slice(tokens[index - 1][2], start));
    if (opens && SENTENCE_OPENERS.has(tokens[index][0].toLowerCase())) {
      // « Après Renault, … » — the name starts one word later, and the word
      // set aside is counted rather than swallowed.
      skipped += 1;
      index += 1;
      continue;
    }
    const [kind, evidence] = typed(tokens, index, length);
    if (length > 1 && HONORIFICS.has(tokens[index][0].toLowerCase())) {
      start = tokens[index + 1][1]; // « Mme » is not part of the name
    }
    const alone = tokens[index][0].toLowerCase();
    const ordinary = PARTICLES.has(alone) || HONORIFICS.has(alone) || alone.length === 1;
    if (length === 1 && opens && kind === 'unknown' && !ordinary) {
      // « Lumière a livré le colis. » — most sentence openers are not names,
      // and this rung has no way to tell which ones are. An opener that is
      // plainly a determiner is not even counted.
      skipped += 1;
    } else if (!(length === 1 && ordinary)) {
      names.push({ text: text.slice(start, end), type: kind, evidence, start, end });
    }
    index += length;
  }
  return { names, skipped_at_sentence_start: skipped, reason: null };
}

/** How many tokens from `index` belong to one capitalised run. */
function runLength(tokens, index, text) {
  if (!UPPER.test(tokens[index][0])) return 0;
  let length = 1;
  let last = index;
  while (last + 1 < tokens.length) {
    const word = tokens[last + 1][0];
    if (!JOINS.test(text.slice(tokens[last][2], tokens[last + 1][1]))) break;
    if (UPPER.test(word)) {
      last += 1;
    } else if (PARTICLES.has(word.toLowerCase()) && last + 2 < tokens.length
      && UPPER.test(tokens[last + 2][0])) {
      last += 2; // a particle only counts between two capitalised words
    } else {
      break;
    }
    length = last - index + 1;
  }
  return length;
}

/** What the sentence proves about this run, and the word that proves it. */
function typed(tokens, index, length) {
  const before = tokens.slice(Math.max(0, index - 2), index).map((t) => t[0].toLowerCase());
  const run = tokens.slice(index, index + length).map((t) => t[0].toLowerCase());
  const after = index + length < tokens.length ? tokens[index + length][0].toLowerCase() : '';
  if (before.length && HONORIFICS.has(before.at(-1))) return ['person', before.at(-1)];
  if (length > 1 && HONORIFICS.has(run[0])) return ['person', run[0]];
  if (LEGAL_FORMS.has(run.at(-1)) && length > 1) return ['company', run.at(-1)];
  if (LEGAL_FORMS.has(after)) return ['company', after];
  if (before.length === 2 && ORG_LEADS.has(before.join(' '))) {
    // « l'entreprise » is two tokens; it is written back as one word.
    return ['company', before.join(before[0].length === 1 ? "'" : ' ')];
  }
  return ['unknown', null];
}
