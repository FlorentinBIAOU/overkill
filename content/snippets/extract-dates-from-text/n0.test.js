import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractDates } from './n0.js';
import essai from '../../tryouts/live/extract-dates-from-text.js';

/** Dates are compared as ISO days: the time of day is not part of the answer. */
const iso = (date) => date.toISOString().slice(0, 10);
const days = (text, dayFirst) => extractDates(text, dayFirst).map((d) => iso(d.date));
const pairs = (text, dayFirst) => extractDates(text, dayFirst).map((d) => [d.text, iso(d.date)]);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « jeudi prochain », « dans quinze jours » et « à partir de demain » ne rendent rien', () => {
  for (const phrase of ['on se voit jeudi prochain', 'livraison dans quinze jours',
    'à partir de demain', 'let us meet next Thursday', 'fin du mois']) {
    assert.deepEqual(days(phrase), [], phrase);
  }
  // Witness: the same sentence with a date written in digits is read.
  assert.deepEqual(pairs('on se voit jeudi 14/03/2024'), [['14/03/2024', '2024-03-14']]);
});

test('point de rupture : l’échec est silencieux, une liste vide et non une erreur', () => {
  const result = extractDates('Relance à faire jeudi prochain, livraison dans quinze jours.');
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test('point de rupture : une date relative avec des chiffres ne rend rien non plus', () => {
  assert.deepEqual(days('livraison dans 15 jours'), []);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit les trois formats dans une phrase', () => {
  const text = 'Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01.';
  assert.deepEqual(pairs(text), [['12/03/2024', '2024-03-12'], ['3 avril 2024', '2024-04-03'], ['2024-03-01', '2024-03-01']]);
});

test('lit les mois en lettres, avec et sans accents, en français et en anglais', () => {
  for (const written of ['1er février 2024', '1er fevrier 2024', '1 February 2024']) {
    assert.deepEqual(pairs(`à compter du ${written}`), [[written, '2024-02-01']], written);
  }
  assert.deepEqual(pairs('à compter du 1er mars 2024'), [['1er mars 2024', '2024-03-01']]);
});

test('les années sur deux chiffres suivent le pivot 69 → 2069, 70 → 1970', () => {
  assert.deepEqual(days('facture du 12.03.24'), ['2024-03-12']);
  assert.deepEqual(days('archive du 12.03.97'), ['1997-03-12']);
  assert.deepEqual(days('01/01/69'), ['2069-01-01']);
  assert.deepEqual(days('01/01/70'), ['1970-01-01']);
});

test('new Date(2024, 1, 31) glisse au 2 mars, et l’extrait refuse le 31/02/2024', () => {
  // docstring js : « `new Date(2024, 1, 31)` does not fail, it quietly rolls over to 2 March ».
  const rolled = new Date(2024, 1, 31);
  assert.equal(rolled.getMonth(), 2);
  assert.equal(rolled.getDate(), 2);
  assert.deepEqual(days('livraison le 31/02/2024'), []);
  assert.deepEqual(days('livraison le 31/04/2024'), []);
  assert.deepEqual(days('livraison le 29/02/2023'), []);
});

test('l’expression régulière accepte 31/02/2024 et 29/02/2023, le calendrier les refuse', () => {
  // L'expression n'est pas exportée en JavaScript : on vérifie qu'elle trouve
  // la forme en changeant le seul jour vers une date réelle.
  assert.deepEqual(days('livraison le 28/02/2024'), ['2024-02-28']);
  assert.deepEqual(days('livraison le 31/02/2024'), []);
});

test('années bissextiles, règle du siècle comprise', () => {
  assert.deepEqual(days('29/02/2024'), ['2024-02-29']);
  assert.deepEqual(days('29/02/2023'), []);
  assert.deepEqual(days('29/02/2000'), ['2000-02-29']);
  assert.deepEqual(days('29/02/1900'), []);
});

test('jour ou mois d’abord, c’est l’appelant qui tranche', () => {
  assert.deepEqual(days('03/04/2024'), ['2024-04-03']);
  assert.deepEqual(days('03/04/2024', false), ['2024-03-04']);
  // Read the other way round, 13 is not a month, and the check catches it.
  assert.deepEqual(days('13/04/2024', false), []);
});

test('l’ordre ISO ne dépend pas de la convention', () => {
  for (const dayFirst of [true, false]) assert.deepEqual(days('2024-03-12', dayFirst), ['2024-03-12']);
});

test('les nombres ordinaires restent intacts', () => {
  assert.deepEqual(days('version 1.2.3, ticket 4512, salle 4, 192.168.1.1'), []);
  assert.deepEqual(days('version 1.2.345'), []);
});

test('un numéro de version à deux chiffres de fin est lu comme une date', () => {
  // « version 2.1.24 » rend le 2 janvier 2024, « 10.1.1.24 » le 1er janvier 2024.
  assert.deepEqual(days('mise à jour vers la version 2.1.24'), []);
  assert.deepEqual(days('serveur 10.1.1.24'), []);
});

test('un passage qui chevauche une date retenue n’est pas une seconde date', () => {
  assert.deepEqual(pairs('3 avril 2024-05-06'), [['3 avril 2024', '2024-04-03']]);
});

test('escalate_when : une convention unique rend des dates plausibles mais fausses sur un corpus mixte', () => {
  const corpus = 'Facture émise le 03/04/2024. Invoice issued 04/05/2024.';
  // The American invoice meant 5 April.
  assert.deepEqual(pairs(corpus, true), [['03/04/2024', '2024-04-03'], ['04/05/2024', '2024-05-04']]);
});

test('INFIRMÉ : verdict_rationale dit que ce que N0 ne sait pas faire, il rend une liste vide, il rend une date fausse', async () => {
  await assert.rejects(async () => {
    assert.deepEqual(days('Invoice issued 04/05/2024, net thirty days.', true), []);
  });
});

test('l’extrait est déterministe et n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
  const text = 'Réunion le 12/03/2024, livraison le 3 avril 2024.';
  assert.deepEqual(pairs(text), pairs(text));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : chaîne vide et texte sans chiffre', () => {
  assert.deepEqual(days(''), []);
  assert.deepEqual(days('   \n\t'), []);
});

test('production : quinze mille dates tiennent dans une borne large', () => {
  // Même algorithme quadratique qu'en Python, mais le moteur JavaScript le
  // parcourt sous la borne ; voir le test DÉFAUT jumeau en Python.
  const text = 'le 12/03/2024, '.repeat(15_000);
  const debut = performance.now();
  assert.equal(extractDates(text).length, 15_000);
  assert.ok(performance.now() - debut < 3_000);
});

test('production : un motif pathologique termine dans une borne large', () => {
  const debut = performance.now();
  assert.deepEqual(days(`1 ${'a'.repeat(1000)} `.repeat(1000)), []);
  assert.deepEqual(days(`1${' '.repeat(200_000)}avril`), []);
  assert.ok(performance.now() - debut < 5_000);
});

test('production : espaces insécables, BOM et largeur nulle autour de la date', () => {
  assert.deepEqual(pairs('3\u00a0avril\u00a02024'), [['3\u00a0avril\u00a02024', '2024-04-03']]);
  assert.deepEqual(pairs('3\u202favril 2024'), [['3\u202favril 2024', '2024-04-03']]);
  assert.deepEqual(pairs('\ufeff12/03/2024\u200b'), [['12/03/2024', '2024-03-12']]);
});

test('production : casse mixte dans le nom du mois', () => {
  assert.deepEqual(pairs('LE 3 AVRIL 2024'), [['3 AVRIL 2024', '2024-04-03']]);
});

test('« 1ER » en capitales n’est pas lu', () => {
  assert.deepEqual(pairs('LE 1ER MARS 2024'), [['1ER MARS 2024', '2024-03-01']]);
});

test('un mois en accents décomposés n’est pas lu', () => {
  assert.deepEqual(pairs('1er fe\u0301vrier 2024'), [['1er fe\u0301vrier 2024', '2024-02-01']]);
});

test('la forme anglaise mois, jour, année n’est pas lue', () => {
  assert.deepEqual(pairs('Payment due March 3, 2024.'), [['March 3, 2024', '2024-03-03']]);
});

test('des chiffres pleine chasse ne sont pas lus en JavaScript, alors que Python les lit', () => {
  assert.deepEqual(pairs('１２/０３/２０２４'), [['１２/０３/２０２４', '2024-03-12']]);
});

test('production : valeurs aux limites du calendrier', () => {
  assert.deepEqual(days('31/12/9999'), ['9999-12-31']);
  assert.deepEqual(days('00/01/2024'), []);
  assert.deepEqual(days('01/13/2024'), []);
  assert.deepEqual(days('31/01/2024'), ['2024-01-31']);
  assert.deepEqual(days('32/01/2024'), []);
});

// ---------------------------------------------------------------------------
// L'essai de la fiche
// ---------------------------------------------------------------------------

const cas = (index, lang) => {
  const { input } = essai.cases[index];
  return typeof input === 'string' ? input : input[lang];
};

test('essai : trois formats dans une phrase de compte rendu, trois dates retenues', () => {
  for (const lang of ['fr', 'en']) {
    const sortie = essai.run(cas(0, lang), lang);
    assert.equal(sortie.rows.rows.length, 3);
    assert.equal(sortie.spans.length, 3);
  }
});

test('essai : la date que le calendrier n’a pas est écartée, le 1er mars reste', () => {
  const sortie = essai.run(cas(1, 'fr'), 'fr');
  assert.deepEqual(sortie.rows.rows.map(([ecrit]) => ecrit), ['1er mars 2024']);
  assert.deepEqual(essai.run(cas(1, 'en'), 'en').rows.rows.map(([ecrit]) => ecrit), ['1 March 2024']);
});

test('essai : la même écriture donne deux jours différents selon la convention', () => {
  const [premiere] = essai.run(cas(2, 'fr'), 'fr').rows.rows;
  assert.equal(premiere[0], '03/04/2024');
  assert.equal(premiere[2].caught, true);
  assert.notEqual(premiere[1], premiere[2].v);
});

test('essai : les échéances relatives ne rendent rien, sans erreur, et le cas est marqué en échec', () => {
  assert.equal(essai.cases[3].fails, true);
  for (const lang of ['fr', 'en']) {
    const sortie = essai.run(cas(3, lang), lang);
    assert.deepEqual(sortie.spans, []);
    assert.equal(sortie.rows, undefined);
    assert.ok(sortie.verdict.label);
  }
  assert.equal(essai.level, 'N0');
});
