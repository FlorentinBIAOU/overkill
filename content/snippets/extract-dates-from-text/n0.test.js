import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { documentConvention, extractDates } from './n0.js';
import essai from '../../tryouts/live/extract-dates-from-text.js';

/** Dates are compared as ISO days: the time of day is not part of the answer.
 *  A date the document does not settle comes back null, and stays null here. */
const iso = (date) => (date === null ? null : date.toISOString().slice(0, 10));
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
  assert.deepEqual(days('delivery in 15 days'), []);
});

test('point de rupture : une date abrégée 3/4/24 est écartée exprès', () => {
  assert.deepEqual(days('rendez-vous le 3/4/24'), []);
  assert.deepEqual(days('mise à jour vers la version 2.1.24'), []);
  assert.deepEqual(pairs('rendez-vous le 03/04/24', true), [['03/04/24', '2024-04-03']]);
  assert.deepEqual(days('le 03/4/24'), []);
  assert.deepEqual(days('le 3/04/24'), []);
  assert.deepEqual(pairs('le 3/4/2024', true), [['3/4/2024', '2024-04-03']]);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit les motifs énumérés du scénario', () => {
  const text = 'Réunion le 12/03/2024, specs 2024-03-12, livraison le 3 avril 2024, invoice March 3, 2024.';
  assert.deepEqual(pairs(text, true), [
    ['12/03/2024', '2024-03-12'], ['2024-03-12', '2024-03-12'], ['3 avril 2024', '2024-04-03'], ['March 3, 2024', '2024-03-03'],
  ]);
});

test('lit les trois formats dans une phrase', () => {
  const text = 'Réunion le 12/03/2024, livraison le 3 avril 2024, gel des specs 2024-03-01.';
  assert.deepEqual(pairs(text, true), [['12/03/2024', '2024-03-12'], ['3 avril 2024', '2024-04-03'], ['2024-03-01', '2024-03-01']]);
});

test('lit les mois en lettres, avec et sans accents, en français et en anglais', () => {
  for (const written of ['1er février 2024', '1er fevrier 2024', '1 February 2024']) {
    assert.deepEqual(pairs(`à compter du ${written}`), [[written, '2024-02-01']], written);
  }
  assert.deepEqual(pairs('à compter du 1er mars 2024'), [['1er mars 2024', '2024-03-01']]);
});

test('les mois abrégés d’une facture sont lus', () => {
  // « with the abbreviations an invoice, a delivery note or an email actually
  // use » ; « The full stop of an abbreviation and the comma that often follows
  // the month are both optional ».
  assert.deepEqual(pairs('Échéance le 3 janv. 2024'), [['3 janv. 2024', '2024-01-03']]);
  assert.deepEqual(pairs('le 03 sept. 2024'), [['03 sept. 2024', '2024-09-03']]);
  assert.deepEqual(pairs('Due Mar 3, 2024'), [['Mar 3, 2024', '2024-03-03']]);
  assert.deepEqual(pairs('3 April, 2024'), [['3 April, 2024', '2024-04-03']]);
  assert.deepEqual(pairs('le 3 déc 2024'), [['3 déc 2024', '2024-12-03']]);
  assert.deepEqual(pairs('due 3 Feb. 2024'), [['3 Feb. 2024', '2024-02-03']]);
  // Témoin : un mot qui n'est pas un mois reste un mot.
  assert.deepEqual(days('le 3 truc 2024'), []);
});

test('une date sans année n’est pas lue', () => {
  // « « le 5 mars », sans année, nomme un jour et pas une date ».
  assert.deepEqual(days('rendez-vous le 5 mars'), []);
  assert.deepEqual(days('due March 5'), []);
  // Témoin : la même date avec son année est lue.
  assert.deepEqual(pairs('rendez-vous le 5 mars 2024'), [['5 mars 2024', '2024-03-05']]);
});

test('les années sur deux chiffres se lisent comme MySQL : 00-69 en 2000, 70-99 en 1900', () => {
  assert.deepEqual(days('01/01/00', true), ['2000-01-01']);
  assert.deepEqual(days('31/12/99'), ['1999-12-31']);
  assert.deepEqual(days('facture du 12.03.24', true), ['2024-03-12']);
  assert.deepEqual(days('archive du 12.03.97', true), ['1997-03-12']);
  assert.deepEqual(days('01/01/69', true), ['2069-01-01']);
  assert.deepEqual(days('01/01/70', true), ['1970-01-01']);
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

test('le pivot des années courtes est juste pour une échéance, faux pour une naissance', () => {
  // « The pivot is right for deadlines and wrong for birth dates: "12/03/65"
  // comes out 2065 ».
  assert.deepEqual(pairs('né le 12/03/65', true), [['12/03/65', '2065-03-12']]);
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

test('le document tranche d’abord, puis l’appelant, puis l’abstention', () => {
  // « one date in it whose first field is above twelve can only be day-first,
  // and that settles every other date of the same document. Failing that, the
  // caller may know the locale of the sender. Failing that too, the snippet
  // abstains ».
  // 1. La preuve interne du document : 25 ne peut être qu'un jour.
  assert.deepEqual(pairs('Commande 25/03/2024, livraison 03/04/2024'), [
    ['25/03/2024', '2024-03-25'], ['03/04/2024', '2024-04-03'],
  ]);
  assert.equal(documentConvention('Commande 25/03/2024, livraison 03/04/2024'), true);
  assert.equal(documentConvention('Order 03/25/2024, delivery 03/04/2024'), false);
  // 2. À défaut, ce que l'appelant sait.
  assert.deepEqual(days('03/04/2024', true), ['2024-04-03']);
  assert.deepEqual(days('03/04/2024', false), ['2024-03-04']);
  // 3. À défaut, l'abstention : la date est rendue sans son jour.
  assert.deepEqual(extractDates('03/04/2024'), [{ text: '03/04/2024', date: null }]);
  assert.equal(documentConvention('03/04/2024'), null);
  // Un document qui se contredit ne tranche rien non plus.
  assert.equal(documentConvention('25/03/2024 puis 03/25/2024'), null);
  // La preuve interne passe avant l'appelant, date par date : 13 n'est pas un mois.
  assert.deepEqual(days('13/04/2024', false), ['2024-04-13']);
});

test('l’ordre ISO ne dépend pas de la convention', () => {
  for (const dayFirst of [true, false]) assert.deepEqual(days('2024-03-12', dayFirst), ['2024-03-12']);
});

test('les nombres ordinaires restent intacts', () => {
  assert.deepEqual(days('version 1.2.3, ticket 4512, salle 4, 192.168.1.1'), []);
  assert.deepEqual(days('version 1.2.345'), []);
});

test('jamais un morceau d’un nombre pointé plus long', () => {
  for (const text of ['serveur 10.1.1.24', 'serveur 10.01.01.24', 'réf. 12/03/2024/5', 'réf. 1.12.03.2024', 'v2.1.24']) {
    assert.deepEqual(days(text), [], text);
  }
  assert.deepEqual(pairs('le 01.01.24', true), [['01.01.24', '2024-01-01']]);
  assert.deepEqual(pairs('facture du 12.03.24.', true), [['12.03.24', '2024-03-12']]);
  assert.deepEqual(pairs('facture du 12/03/2024.', true), [['12/03/2024', '2024-03-12']]);
});

test('un passage qui chevauche une date retenue n’est pas une seconde date', () => {
  assert.deepEqual(pairs('3 avril 2024-05-06'), [['3 avril 2024', '2024-04-03']]);
});

test('escalate_when : une convention unique rend des dates plausibles mais fausses sur un corpus mixte', () => {
  const corpus = 'Facture émise le 03/04/2024. Invoice issued 04/05/2024.';
  // The American invoice meant 5 April.
  assert.deepEqual(pairs(corpus, true), [['03/04/2024', '2024-04-03'], ['04/05/2024', '2024-05-04']]);
});

test('verdict : ce qu’il ne voit pas est une liste vide, ce qu’il lit à l’envers une date plausible', () => {
  assert.deepEqual(days('Relance jeudi prochain.'), []);
  assert.deepEqual(days('Invoice issued 04/05/2024, net thirty days.', true), ['2024-05-04']);
  assert.deepEqual(days('Invoice issued 04/05/2024, net thirty days.', false), ['2024-04-05']);
});

test('l’extrait est déterministe et n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
  const text = 'Réunion le 12/03/2024, livraison le 3 avril 2024.';
  assert.deepEqual(pairs(text, true), pairs(text, true));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : chaîne vide et texte sans chiffre', () => {
  assert.deepEqual(days(''), []);
  assert.deepEqual(days('   \n\t'), []);
});

test('production : quinze mille dates tiennent dans une borne large', () => {
  const text = 'le 12/03/2024, '.repeat(15_000);
  const debut = performance.now();
  assert.equal(extractDates(text).length, 15_000);
  assert.ok(performance.now() - debut < 3_000);
});

test('production : un motif pathologique termine dans une borne large', () => {
  const debut = performance.now();
  assert.deepEqual(days(`1 ${'a'.repeat(1000)} `.repeat(1000)), []);
  assert.deepEqual(days(`1${' '.repeat(200_000)}avril`), []);
  assert.deepEqual(days(`March${' '.repeat(200_000)}3`), []);
  assert.deepEqual(days('1.'.repeat(100_000)), []);
  assert.deepEqual(days('12/'.repeat(60_000)), []);
  assert.ok(performance.now() - debut < 5_000);
});

test('une longue suite de lettres est lue une fois, pas une fois par lettre', () => {
  const debut = performance.now();
  assert.deepEqual(days(`March${'a'.repeat(100_000)} 3, 2024`), []);
  assert.deepEqual(pairs(`${`${'a'.repeat(100)} `.repeat(1000)}March 3, 2024`), [['March 3, 2024', '2024-03-03']]);
  assert.ok(performance.now() - debut < 1_000);
});

test('une longue suite de marques combinantes est lue une fois, elle aussi', () => {
  // « a combining mark is not the start of a word — so a long run of letters
  // or of marks is read once, not once per character ». Sans le regard arrière
  // sur les marques, vingt mille marques prenaient plusieurs secondes.
  const debut = performance.now();
  assert.deepEqual(days(`a${'\u0301'.repeat(20_000)}`), []);
  assert.ok(performance.now() - debut < 1_000);
  // Témoin : une date derrière la même suite est toujours lue.
  assert.deepEqual(pairs(`a${'\u0301'.repeat(20_000)} March 3, 2024`), [['March 3, 2024', '2024-03-03']]);
});

test('production : espaces insécables, BOM et largeur nulle autour de la date', () => {
  assert.deepEqual(pairs('3\u00a0avril\u00a02024'), [['3\u00a0avril\u00a02024', '2024-04-03']]);
  assert.deepEqual(pairs('3\u202favril 2024'), [['3\u202favril 2024', '2024-04-03']]);
  assert.deepEqual(pairs('\ufeff12/03/2024\u200b', true), [['12/03/2024', '2024-03-12']]);
});

test('production : casse mixte dans le nom du mois', () => {
  assert.deepEqual(pairs('LE 3 AVRIL 2024'), [['3 AVRIL 2024', '2024-04-03']]);
});

test('production : « 1ER » en capitales et ordinaux anglais sont lus', () => {
  assert.deepEqual(pairs('LE 1ER MARS 2024'), [['1ER MARS 2024', '2024-03-01']]);
  assert.deepEqual(pairs('due 3rd April 2024'), [['3rd April 2024', '2024-04-03']]);
  assert.deepEqual(pairs('DUE 3RD APRIL 2024'), [['3RD APRIL 2024', '2024-04-03']]);
  assert.deepEqual(pairs('the 22nd May 2024 and 1st June 2024'), [['22nd May 2024', '2024-05-22'], ['1st June 2024', '2024-06-01']]);
});

test('production : un mois en accents décomposés est lu', () => {
  assert.deepEqual(pairs('1er fe\u0301vrier 2024'), [['1er fe\u0301vrier 2024', '2024-02-01']]);
});

test('production : la forme anglaise mois, jour, année est lue', () => {
  assert.deepEqual(pairs('Payment due March 3, 2024.'), [['March 3, 2024', '2024-03-03']]);
  assert.deepEqual(pairs('Payment due March 3rd, 2024.'), [['March 3rd, 2024', '2024-03-03']]);
  assert.deepEqual(pairs('Payment due march 3 2024.'), [['march 3 2024', '2024-03-03']]);
  assert.deepEqual(days('Payment due March 32, 2024.'), []);
});

test('production : des chiffres pleine chasse sont lus dans les deux langages', () => {
  assert.deepEqual(pairs('１２/０３/２０２４', true), [['１２/０３/２０２４', '2024-03-12']]);
  assert.deepEqual(pairs('３ avril ２０２４'), [['３ avril ２０２４', '2024-04-03']]);
  assert.deepEqual(days('٠٣/٠٤/٢٠٢٤'), []);
});

test('production : l’an 24 écrit sur quatre chiffres reste l’an 24', () => {
  // Commentaire de toDate : « unlike Date.UTC, keeps year 24 as 24, not 1924 ».
  assert.deepEqual(pairs('01/01/0024', true), [['01/01/0024', '0024-01-01']]);
  assert.deepEqual(pairs('0024-01-01'), [['0024-01-01', '0024-01-01']]);
  assert.deepEqual(pairs('01/01/0001', true), [['01/01/0001', '0001-01-01']]);
  assert.deepEqual(days('01/01/0000', true), []);
});

test('production : valeurs aux limites du calendrier', () => {
  assert.deepEqual(days('31/12/9999'), ['9999-12-31']);
  assert.deepEqual(days('00/01/2024', true), []);
  assert.deepEqual(days('01/13/2024', true), ['2024-01-13']);
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
