/**
 * Tests du niveau N1 : l'analyseur de dates `chrono-node`.
 *
 * Ce qu'ils prouvent : ce que la bibliothèque lit et ce qu'elle ne lit pas, sur
 * les exemples cités par la fiche, et que la date de référence est bien celle du
 * document et non celle de l'exécution.
 *
 * Ce qu'ils ne prouvent pas : que `chrono-node` lit juste sur un corpus. Sa
 * version est épinglée dans package.json ; une autre version peut lire
 * autrement, et c'est précisément ce que la docstring de l'extrait dit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { extractDates as extractN0 } from './n0.js';
import { LANGUAGES, extractDates } from './n1.js';

// La date du document : un mardi, choisi parce que « jeudi prochain » se lit
// différemment selon l'analyseur, ce que la fiche dit.
const REFERENCE = new Date(2024, 2, 12);

const jours = (text, reference = REFERENCE, ...rest) =>
  extractDates(text, reference, ...rest).map((r) => [r.text, iso(r.date)]);

const iso = (date) => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une durée écrite en toutes lettres ne rend rien', () => {
  // « « dans quinze jours » ne rend rien, quand « dans 15 jours » rend le 27 mars ».
  assert.deepEqual(jours('échéance dans quinze jours'), []);
  // Témoin : la même durée en chiffres est lue.
  assert.deepEqual(jours('échéance dans 15 jours'), [['dans 15 jours', '2024-03-27']]);
});

test('point de rupture : l’analyseur ne s’abstient jamais', () => {
  // « sur « 03/04/2024 » seul il tranche selon ses propres règles, et les deux
  // bibliothèques ne tranchent pas pareil — 4 mars pour dateparser, 3 avril
  // pour chrono-node ».
  assert.deepEqual(jours('le 03/04/2024'), [['03/04/2024', '2024-04-03']]);
  // Témoin : N0, lui, s'abstient plutôt que de trancher.
  assert.deepEqual(extractN0('le 03/04/2024'), [{ text: '03/04/2024', date: null }]);
});

test('point de rupture : un mois abrégé n’est pas lu comme par N0', () => {
  // « On "3 janv. 2024" `dateparser` answers 3 January 2025 and `chrono-node`
  // answers nothing, where rung N0 answers 3 January 2024 ».
  assert.deepEqual(jours('Échéance le 3 janv. 2024'), []);
  assert.equal(extractN0('Échéance le 3 janv. 2024')[0].date.toISOString().slice(0, 10), '2024-01-03');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les dates relatives sont comptées depuis la référence', () => {
  // « "dans 15 jours" has to be counted from a date ».
  assert.deepEqual(jours('à régler dans 15 jours'), [['dans 15 jours', '2024-03-27']]);
  assert.deepEqual(jours('a\u0300 partir de demain'), [['demain', '2024-03-13']]);
  // La même phrase comptée depuis un autre document donne un autre jour.
  assert.deepEqual(jours('à régler dans 15 jours', new Date(2024, 11, 24)), [['dans 15 jours', '2025-01-08']]);
});

test('la référence est obligatoire, et c’est la date du document', () => {
  // « `reference` has no default here, on purpose ».
  assert.throws(() => extractDates('dans 15 jours'), TypeError);
  assert.throws(() => extractDates('dans 15 jours', null), /date of the document/);
  assert.throws(() => extractDates('dans 15 jours', '2024-03-12'), /date of the document/);
  assert.throws(() => extractDates('dans 15 jours', new Date('pas une date')), /date of the document/);
});

test('une échéance se lit vers l’avant', () => {
  // « "le 3 janvier" in a March document is the next one, not the one gone by ».
  assert.deepEqual(jours('échéance le 3 janvier'), [['3 janvier', '2025-01-03']]);
});

test('les langues sont déclarées par l’appelant', () => {
  // « `chrono` has one parser per language, and the French one reads nothing
  // English ».
  assert.deepEqual(LANGUAGES, ['fr', 'en']);
  assert.deepEqual(jours('due in 15 days', REFERENCE, ['en']), [['in 15 days', '2024-03-27']]);
  assert.deepEqual(jours('due in 15 days', REFERENCE, ['fr']), []);
  assert.throws(() => extractDates('dans 15 jours', REFERENCE, []), /at least one language/);
  assert.throws(() => extractDates('dans 15 jours', REFERENCE, ['kl']), /no parser for kl/);
});

test('les deux langues demandées ne lisent pas deux fois les mêmes mots', () => {
  // « the first language asked for wins, as in the Python version ».
  assert.deepEqual(jours('livraison le 03/04/2024'), [['03/04/2024', '2024-04-03']]);
});

test('n1 n’importe que chrono-node', () => {
  // « installed rather than written » ; risks.vendor_lock: library.
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['chrono-node']);
});

test('n1 est déterministe', () => {
  // risks.deterministic: true.
  const texte = 'Livraison dans 15 jours, facture le 03/04/2024.';
  assert.deepEqual(jours(texte), jours(texte));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : texte vide ou sans date', () => {
  assert.deepEqual(jours(''), []);
  assert.deepEqual(jours('   '), []);
  assert.deepEqual(jours('aucune date ici'), []);
});

test('production : entrée ordinaire d’un document de gestion', () => {
  // Entrée banale : le corps d'un courriel de relance.
  const courriel = 'Bonjour, votre facture du 03/04/2024 reste impayée. '
    + 'Merci de régler dans 15 jours, soit avant le 3 janv. 2024.';
  const lus = jours(courriel);
  assert.ok(lus.some(([, day]) => day === '2024-03-27'));
  assert.ok(lus.some(([written]) => written === '03/04/2024'));
});

test('production : un document long dans une borne large', () => {
  const texte = 'Livraison dans 15 jours. '.repeat(400);
  const debut = performance.now();
  const lus = jours(texte);
  assert.ok(performance.now() - debut < 60_000); // borne d'effondrement, pas une mesure
  assert.ok(lus.length >= 1);
});

test('production : accents décomposés, espaces insécables et largeur nulle', () => {
  assert.deepEqual(jours('a\u0300 partir de demain'), [['demain', '2024-03-13']]);
  // `chrono` rend le texte tel qu'il était écrit, espace insécable compris.
  assert.deepEqual(jours('dans\u00a015 jours').map(([, day]) => day), ['2024-03-27']);
  assert.deepEqual(jours('dans 15 jo\u200burs'), []);
});

test('production : valeurs aux limites de la référence', () => {
  assert.deepEqual(jours('dans 1 jour', new Date(2024, 1, 28)), [['dans 1 jour', '2024-02-29']]);
  assert.deepEqual(jours('dans 1 jour', new Date(2023, 11, 31)), [['dans 1 jour', '2024-01-01']]);
});
