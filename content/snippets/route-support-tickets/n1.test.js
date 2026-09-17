import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as n0 from './n0.js';
import { DEFAULT_TEAM, rank, route, train } from './n1.js';
import essai from '../../tryouts/live/route-support-tickets.js';

// An archive as an export gives it: the ticket, and the team that resolved it.
const BILLING = [
  'Ma facture de janvier est trop élevée, pouvez-vous vérifier le montant',
  "Je demande le remboursement de la commande que j'ai annulée hier",
  'Le prélèvement automatique est passé deux fois ce mois-ci',
  "Pouvez-vous m'envoyer un devis pour dix licences supplémentaires",
  'Mon IBAN a changé, comment mettre à jour le moyen de paiement',
  'Je ne comprends pas la ligne de TVA sur la facture de 2024',
  'Le paiement par carte a été refusé trois fois de suite',
];

const TECHNICAL = [
  'Impossible de me connecter depuis ce matin, la page reste blanche',
  "L'application plante dès que j'ouvre le tableau de bord",
  "J'ai perdu mon mot de passe et le lien de réinitialisation ne marche pas",
  "Une erreur 500 s'affiche quand j'enregistre une fiche",
  'La synchronisation est en panne depuis la mise à jour de mardi',
  'Mon identifiant ne fonctionne plus après le changement de poste',
  "Le bouton d'export ne répond plus dans le navigateur",
];

const SHIPPING = [
  "Mon colis n'est toujours pas arrivé après trois semaines",
  'La livraison a été annulée par le transporteur sans explication',
  "Le suivi indique livré mais je n'ai rien reçu",
  "Je souhaite changer l'adresse de livraison de ma commande",
  "L'expédition est bloquée au dépôt depuis lundi",
  'Le colis est arrivé ouvert et un article manque',
  'Le retard de livraison dépasse la date annoncée',
];

const ARCHIVE = [...BILLING, ...TECHNICAL, ...SHIPPING];
const TEAMS = [...BILLING.map(() => 'billing'), ...TECHNICAL.map(() => 'technical'), ...SHIPPING.map(() => 'shipping')];

const UNKNOWN = 'Votre entrepôt accepte-t-il les visites scolaires le mercredi';
const TWO_TEAMS = "Le colis n'est jamais arrivé et le prélèvement est passé quand même";
const NO_KEYWORD = 'La page reste blanche quand je valide le formulaire';
const SHRUG = 'Bonjour, depuis hier je n’arrive plus à faire ce que je faisais avant';

const model = train(ARCHIVE, TEAMS);

function routeEnPython(tickets) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const r = spawnSync(python, ['-c',
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n1 import train, route; d = json.load(sys.stdin); ' +
    'm = train(d["archive"], d["teams"]); json.dump([route(m, t) for t in d["tickets"]], sys.stdout)',
    fileURLToPath(new URL('.', import.meta.url))], { input: JSON.stringify({ archive: ARCHIVE, teams: TEAMS, tickets }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('INFIRMÉ : le ticket inconnu ne recoupe aucun mot de l’archive', () => {
  // Il partage « le » avec l'archive, qui est dans le vocabulaire appris.
  const mots = UNKNOWN.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu);
  assert.throws(() => assert.deepEqual(mots.filter((m) => model.vocabulary.terms.has(m)), []));
});

test('point de rupture : les trois équipes ressortent presque à égalité et le seuil n’est pas atteint', () => {
  const scores = rank(model, UNKNOWN).map(([, s]) => s);
  assert.ok(Math.max(...scores) - Math.min(...scores) < 0.1);
  assert.ok(scores[0] < 0.5);
  assert.equal(route(model, UNKNOWN), DEFAULT_TEAM);
  assert.equal(route(model, 'Le prélèvement de février est passé deux fois sur mon compte'), 'billing');
});

test('point de rupture : N1 n’a pas supprimé la file par défaut, il l’a rétrécie', () => {
  const tickets = [UNKNOWN, NO_KEYWORD, 'L’application plante au démarrage', 'Mon adresse de livraison a changé',
    'Le paiement a été refusé', 'Le suivi indique livré mais rien reçu', 'Je ne comprends pas la ligne de TVA', SHRUG];
  const defautN0 = tickets.filter((t) => n0.route(t) === n0.DEFAULT_TEAM);
  const defautN1 = tickets.filter((t) => route(model, t) === DEFAULT_TEAM);
  assert.ok(defautN1.length > 0 && defautN1.length < defautN0.length);
  assert.ok(defautN1.every((t) => defautN0.includes(t)));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('route un ticket qu’il n’a jamais vu', () => {
  assert.equal(route(model, 'Le montant prélevé sur ma facture de février est faux'), 'billing');
  assert.equal(route(model, "Le tableau de bord ne s'ouvre plus depuis la mise à jour"), 'technical');
  assert.equal(route(model, 'Le transporteur a livré le colis chez le voisin'), 'shipping');
});

test('attrape un ticket qui n’emploie aucun mot-clé de N0', () => {
  assert.equal(route(model, NO_KEYWORD), 'technical');
  assert.equal(n0.route(NO_KEYWORD), n0.DEFAULT_TEAM);
});

test('les accents et la casse ne coûtent rien', () => {
  assert.equal(route(model, 'PRELEVEMENT en double sur ma facture'), 'billing');
  assert.deepEqual(rank(model, 'Prélèvement en double'.normalize('NFD')), rank(model, 'Prélèvement en double'));
});

test('les paires de mots sont apprises avec les mots seuls', () => {
  for (const term of ['mot', 'mot de', 'de passe', 'passe']) assert.ok(model.vocabulary.terms.has(term), term);
});

test('une archive déséquilibrée pondérée ne répond pas l’équipe la plus chargée', () => {
  // Docstring : « Each example is weighted by the rarity of its team: […] an
  // unweighted model learns to answer the busiest team ». Trente-cinq tickets de
  // facturation contre deux de livraison, et le ticket part quand même chez
  // livraison — la même équipe que Python, qui vérifie en plus, sur un modèle
  // non pondéré, que la réponse serait « billing ».
  const archive = [...Array(5).fill(BILLING).flat(), ...SHIPPING.slice(0, 2), ...TECHNICAL];
  const equipes = [...Array(35).fill('billing'), 'shipping', 'shipping', ...Array(7).fill('technical')];
  const premier = rank(train(archive, equipes), 'La livraison du colis est en retard')[0][0];
  assert.notEqual(premier, 'billing');
  assert.equal(premier, 'shipping');
});

test('réentraîné le temps de lire la phrase : 21 tickets en moins d’une seconde', () => {
  const debut = performance.now();
  train(ARCHIVE, TEAMS);
  assert.ok(performance.now() - debut < 1000);
});

test('rank montre l’équipe suivante', () => {
  const ranked = rank(model, TWO_TEAMS);
  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.slice(0, 2).map(([team]) => team), ['shipping', 'billing']);
  assert.ok(ranked[1][1] > ranked[2][1]);
  assert.ok(Math.abs(ranked.reduce((s, [, p]) => s + p, 0) - 1) < 1e-9);
});

test('le plancher est à vous de le fixer', () => {
  const ticket = 'Le montant prélevé sur ma facture de février est faux';
  const confiance = rank(model, ticket)[0][1];
  assert.equal(route(model, ticket, { minConfidence: 0 }), 'billing');
  assert.equal(route(model, ticket, { minConfidence: confiance }), 'billing');
  assert.equal(route(model, ticket, { minConfidence: confiance + 1e-9 }), DEFAULT_TEAM);
  assert.equal(route(model, ticket, { minConfidence: 1 }), DEFAULT_TEAM);
  assert.equal(route(model, UNKNOWN, { defaultTeam: 'triage' }), 'triage');
});

test('déterministe : le même export redonne le même modèle', () => {
  assert.deepEqual(rank(train(ARCHIVE, TEAMS), TWO_TEAMS), rank(model, TWO_TEAMS));
});

test('router un ticket prend moins d’une milliseconde une fois le modèle entraîné', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) route(model, TWO_TEAMS);
  assert.ok(performance.now() - debut < 1000);
});

test('l’essai rend ce que ses cas annoncent', () => {
  const run = (i, lang) => essai.run(typeof essai.cases[i].input === 'string' ? essai.cases[i].input : essai.cases[i].input[lang], lang);
  assert.equal(run(0, 'fr').verdict.label, 'Le ticket part chez Facturation');
  assert.equal(run(1, 'fr').verdict.label, 'Le ticket part chez Technique');
  const deux = run(2, 'fr');
  assert.deepEqual(deux.rows.rows.slice(0, 2).map((r) => r[0].v ?? r[0]), ['Livraison', 'Facturation']);
  assert.equal(run(3, 'fr').verdict.label, 'Le ticket repart dans la file par défaut');
  assert.equal(run(3, 'en').verdict.label, 'The ticket returns to the default queue');
  assert.equal(run(0, 'fr').note, 'Modèle entraîné sur 21 tickets résolus, sept par équipe.');
  const scoresFr = run(3, 'fr').rows.rows.map((r) => Number.parseInt(r[1], 10));
  assert.ok(Math.max(...scoresFr) - Math.min(...scoresFr) < 10);
});

test('essai : en anglais aussi, aucune équipe ne se détache assez', () => {
  // « the archive only knows “does” and “on”: no team stands out, the best one
  // stays under the floor » : 40 %, 37 %, 23 %, et le meilleur sous le plancher.
  const scores = essai.run(essai.cases[3].input.en, 'en').rows.rows.map((r) => Number.parseInt(r[1], 10));
  assert.deepEqual(scores, [40, 37, 23]);
  assert.ok(Math.max(...scores) < 50);
  assert.equal(essai.run(essai.cases[3].input.en, 'en').verdict.label, 'The ticket returns to the default queue');
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un ticket vide part dans la file par défaut', () => {
  assert.equal(route(model, ''), DEFAULT_TEAM);
});

test('une archive d’une seule équipe est refusée', () => {
  // Elle routerait tout, même un ticket sans aucun mot connu, avec une confiance
  // de 1 : le refus vient à l'entraînement, pas à la première question. Python
  // lève de même.
  assert.throws(
    () => train(BILLING, BILLING.map(() => 'billing')),
    { name: 'RangeError', message: /one team per ticket, and at least two teams/ },
  );
});

test('production : une archive vide lève à l’entraînement', () => {
  assert.throws(() => train([], []), { name: 'RangeError', message: /at least two teams/ });
  // Une étiquette par ticket, aussi : les longueurs doivent coïncider.
  assert.throws(() => train(BILLING, ['billing']), { name: 'RangeError' });
});

test('une archive de 630 tickets au vocabulaire varié s’entraîne vite', () => {
  // Chaque ligne TF-IDF est dense (taille du vocabulaire) et chaque passe les
  // parcourt toutes : 210 tickets, 0,6 s ; 525 tickets, 6,3 s observés ici.
  // scikit-learn, creux, entraîne les mêmes 630 tickets en 0,35 s.
  const equipes = ['billing', 'technical', 'shipping'];
  const tickets = Array.from({ length: 630 }, (_, i) => `Commande ${10000 + i} client ${(i * 7919) % 100000} probleme numero ${i}`);
  const debut = performance.now();
  train(tickets, tickets.map((_, i) => equipes[i % 3]));
  assert.ok(performance.now() - debut < 2000);
});

test('production : un ticket d’un mégaoctet, emoji, BOM et insécables', () => {
  const debut = performance.now();
  assert.equal(route(model, "\ufeff📦 Le colis\u00a0n'est pas arrivé ".repeat(30_000)), 'shipping');
  assert.ok(performance.now() - debut < 10_000);
});

test('Python et JavaScript routent les mêmes tickets vers les mêmes files', () => {
  // Sans régularisation, le modèle JS est bien plus sûr de lui : TWO_TEAMS part
  // chez livraison (0,88) et SHRUG chez livraison (0,60), deux files par défaut en Python.
  const tickets = [TWO_TEAMS, SHRUG, UNKNOWN, NO_KEYWORD];
  assert.deepEqual(routeEnPython(tickets), tickets.map((t) => route(model, t)));
});
