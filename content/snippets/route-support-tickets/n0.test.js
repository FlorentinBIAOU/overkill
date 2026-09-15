import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DEFAULT_TEAM, RULES, matches, route } from './n0.js';

// A handful of tickets as a support desk receives them: French, hurried, and
// rarely limited to one subject.
const BILLING = 'Ma facture de janvier est trop élevée, pouvez-vous vérifier ?';
const TECHNICAL = "Impossible d'ouvrir une connexion depuis ce matin.";
const SHIPPING = "Mon colis n'est toujours pas arrivé après trois semaines.";

const TWO_TEAMS = "Le colis n'est jamais arrivé et le prélèvement est passé quand même.";
const NO_TEAM = "Bonjour, depuis hier je n'arrive plus à faire ce que je faisais avant.";

function enPython(tickets) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const r = spawnSync(python, ['-c',
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n0 import route, matches; ' +
    'json.dump([[route(t), matches(t)] for t in json.load(sys.stdin)], sys.stdout)',
    fileURLToPath(new URL('.', import.meta.url))], { input: JSON.stringify(tickets), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un ticket qui appartient à deux équipes perd sa moitié colis', () => {
  assert.deepEqual(matches(TWO_TEAMS), { billing: ['prélèvement'], shipping: ['colis'] });
  const decision = route(TWO_TEAMS);
  assert.equal(decision, 'billing');
  assert.equal(typeof decision, 'string');
  assert.ok(!decision.includes('shipping'));
  assert.equal(route(SHIPPING), 'shipping');
});

test('point de rupture : un ticket qui ne déclenche aucune équipe part dans la file par défaut', () => {
  assert.deepEqual(matches(NO_TEAM), {});
  assert.equal(route(NO_TEAM), DEFAULT_TEAM);
  assert.equal(route('Bonjour, depuis hier la connexion ne marche plus.'), 'technical');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('route chaque ticket vers son équipe', () => {
  assert.equal(route(BILLING), 'billing');
  assert.equal(route(TECHNICAL), 'technical');
  assert.equal(route(SHIPPING), 'shipping');
});

test('Python et JavaScript routent de même', () => {
  const tickets = [BILLING, TECHNICAL, SHIPPING, TWO_TEAMS, NO_TEAM, '', 'PRÉLÈVEMENT en double',
    'Prélèvement refusé'.normalize('NFD'), 'Mes factures de mars', 'le panneau solaire',
    'mot de passe perdu', "l'expédition 📦 est en retard"];
  assert.deepEqual(enPython(tickets), tickets.map((t) => [route(t), matches(t)]));
});

test('les accents et la casse ne coûtent rien', () => {
  assert.equal(route('PRÉLÈVEMENT en double sur mon compte'), 'billing');
  assert.equal(route('prelevement en double sur mon compte'), 'billing');
  assert.equal(route('Prélèvement en double'.normalize('NFD')), 'billing');
});

test('pluriels et formes dérivées se déclenchent encore', () => {
  assert.equal(route('Mes factures de mars sont fausses'), 'billing');
  assert.equal(route('Des erreurs apparaissent à chaque export'), 'technical');
  assert.equal(route('Les livraisons du mois sont toutes en retard'), 'shipping');
});

test('INFIRMÉ : facture déclenche aussi facturation', () => {
  // « facturation » s'écrit f-a-c-t-u-r-a : le préfixe « facture » n'y est pas.
  assert.throws(() => assert.deepEqual(matches('Question sur la facturation'), { billing: ['facture'] }));
});

test('le prix de la frontière à gauche : un mot plus long qui commence pareil', () => {
  assert.deepEqual(matches('Le panneau solaire est tombé'), { technical: ['panne'] });
  assert.deepEqual(matches('Votre devise préférée ?'), { billing: ['devis'] });
  assert.deepEqual(matches('un antibug'), {});
});

test('la priorité est l’ordre de RULES, et rien d’autre', () => {
  assert.deepEqual(RULES.map(([team]) => team), ['billing', 'technical', 'shipping']);
  RULES.reverse();
  try {
    assert.equal(route(TWO_TEAMS), 'shipping');
  } finally {
    RULES.reverse();
  }
});

test('un ticket vide part dans la file par défaut', () => {
  assert.equal(route(''), DEFAULT_TEAM);
});

test('la file par défaut est nommée par l’appelant', () => {
  assert.equal(route('Bonjour, merci de me rappeler.', 'triage'), 'triage');
});

test('matches montre ce que les règles ont vu', () => {
  assert.deepEqual(matches(SHIPPING), { shipping: ['colis'] });
  assert.deepEqual(matches('facture, devis et paiement'), { billing: ['facture', 'devis', 'paiement'] });
});

test('déterministe, et bibliothèque standard seule', () => {
  assert.deepEqual(new Set(Array.from({ length: 10 }, () => route(TWO_TEAMS))), new Set(['billing']));
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.equal(/^import /m.test(source), false);
});

test('router un ticket prend moins d’une milliseconde', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) route(TWO_TEAMS);
  assert.ok(performance.now() - debut < 1000);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un ticket d’un mégaoctet avec fil transféré termine vite', () => {
  const ticket = `${'> Le transfert précédent, sans mot-clé, ligne après ligne.\n'.repeat(18_000)}Ma facture est fausse`;
  const debut = performance.now();
  assert.equal(route(ticket), 'billing');
  assert.ok(performance.now() - debut < 5000);
});

test('production : emoji, BOM et casse mixte', () => {
  assert.equal(route('\ufeff📦 CoLiS perdu !!'), 'shipping');
});

test('production : un mot-clé de plusieurs mots avec une espace insécable ne se déclenche pas', () => {
  assert.equal(route('mot de passe oublié'), 'technical');
  assert.equal(route('mot\u00a0de\u00a0passe oublié'), DEFAULT_TEAM);
  assert.equal(route('mot  de passe oublié'), DEFAULT_TEAM);
});

test('production : un caractère de largeur nulle dans un mot-clé le cache', () => {
  assert.equal(route('fac\u200bture impayée'), DEFAULT_TEAM);
});

test('DÉFAUT : un ticket à écritures mélangées est routé de même dans les deux langages', () => {
  // `\b` sans drapeau u est ASCII : « 我的colis » part chez livraison ici, en file par défaut en Python.
  assert.throws(() => {
    const tickets = ['我的colis est perdu', 'Привет,colis'];
    assert.deepEqual(enPython(tickets), tickets.map((t) => [route(t), matches(t)]));
  });
});

test('production : un ticket absent lève', () => {
  assert.throws(() => route(null), TypeError);
});
