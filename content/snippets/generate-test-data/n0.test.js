import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { draw, finalise, generateRows, stableHash } from './n0.js';
import { hashWord } from '../_harness/fake-llm.mjs';
import essai from '../../tryouts/live/generate-test-data.js';

// The schema lives in the test, never in the snippet: the snippet shows a
// generator, not one company's order table.
//
// Every value below is invented. The addresses are built on example.test, a
// domain reserved for exactly this, so no message can ever leave for a real
// mailbox.
const ORDERS = {
  order_id: { type: 'sequence', prefix: 'ORD-', width: 5 },
  email: { type: 'sequence', prefix: 'user-', width: 4, suffix: '@example.test' },
  city: { type: 'choice', values: ['Paris', 'Lyon', 'Nantes', 'Lille'] },
  quantity: { type: 'int', min: 1, max: 9 },
  signed_up_on: { type: 'date', start: '2024-01-01', days: 365 },
  newsletter: { type: 'bool', true_percent: 30 },
};

// The exact rows expected for one seed. The same literal appears in
// n0.test.py: that is what pins the two implementations to each other, and it
// would break the moment either language drew a different number for the same
// cell.
const GOLDEN = [
  {
    order_id: 'ORD-00001',
    email: 'user-0001@example.test',
    city: 'Paris',
    quantity: 9,
    signed_up_on: '2024-09-18',
    newsletter: true,
  },
  {
    order_id: 'ORD-00002',
    email: 'user-0002@example.test',
    city: 'Nantes',
    quantity: 7,
    signed_up_on: '2024-08-02',
    newsletter: false,
  },
  {
    order_id: 'ORD-00003',
    email: 'user-0003@example.test',
    city: 'Lyon',
    quantity: 4,
    signed_up_on: '2024-02-23',
    newsletter: true,
  },
];

const GRAINES_ESSAI = essai.cases.map((cas) => cas.input);
const UNIT = '\u001f';

/** Exécute le vrai n0.py, pour chaque [schema, count, seed]. */
function generateRowsEnPython(appels) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n0 import generate_rows; ' +
    'json.dump([generate_rows(s, n, g) for s, n, g in json.load(sys.stdin)], sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify(appels),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

/**
 * Stands in for the production code under test: the mailbox an address belongs
 * to, used as the key of an account.
 *
 * It has a bug, and the point of the test below is that generated data can
 * never show it.
 */
function accountKey(email) {
  return email.split('@')[0].toLowerCase();
}

/** La boîte réelle d'une adresse : sans étiquette après un +, sans casse. */
function boite(email) {
  const [locale, domaine] = email.toLowerCase().split('@');
  return `${locale.split('+')[0]}@${domaine}`;
}

/** La propriété qu'une suite écrirait : même boîte, même compte. Rend [vérifiées, échecs]. */
function pairesDeMemeBoiteMalFusionnees(adresses) {
  let verifiees = 0;
  let echecs = 0;
  for (let i = 0; i < adresses.length; i += 1) {
    for (let j = i + 1; j < adresses.length; j += 1) {
      const [a, b] = [adresses[i], adresses[j]];
      if (a !== b && boite(a) === boite(b)) {
        verifiees += 1;
        if (accountKey(a) !== accountKey(b)) echecs += 1;
      }
    }
  }
  return [verifiees, echecs];
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : aucune adresse n’a de plus, de majuscule ni d’apostrophe', () => {
  for (const graine of ['orders-2024', ...GRAINES_ESSAI]) {
    for (const nombre of [1, 500, 5000]) {
      const adresses = generateRows(ORDERS, nombre, graine).map((row) => row.email);
      assert.ok(!adresses.some((a) => a.includes('+')));
      assert.ok(!adresses.some((a) => a !== a.toLowerCase()));
      assert.ok(!adresses.some((a) => a.includes("'") || a.includes('\u2019')));
      assert.ok(adresses.every((a) => /^user-\d{4,}@example\.test$/.test(a)));
    }
  }
});

test('point de rupture : la fonction qui oublie l’étiquette reste verte sur le jeu généré', () => {
  const addresses = generateRows(ORDERS, 500, 'orders-2024').map((row) => row.email);

  // The suite passes: every generated address yields its own account key.
  const keys = addresses.map(accountKey);
  assert.equal(new Set(keys).size, keys.length);
  // La propriété « même boîte, même compte » passe… sur zéro paire vérifiée.
  assert.deepEqual(pairesDeMemeBoiteMalFusionnees(addresses), [0, 0]);

  // In production, these two spellings reach one mailbox and must share one
  // account. They do not.
  assert.notEqual(accountKey('i.fontaine@example.test'), accountKey('i.fontaine+billing@example.test'));
});

test('point de rupture : témoin, la même suite tombe dès que le schéma porte la forme réelle', () => {
  const reelles = {
    email: {
      type: 'choice',
      values: ['i.fontaine@example.test', 'i.fontaine+billing@example.test', 'M.Villeneuve@example.test'],
    },
  };
  const adresses = generateRows(reelles, 50, 'orders-2024').map((row) => row.email);
  const [verifiees, echecs] = pairesDeMemeBoiteMalFusionnees(adresses);
  assert.ok(verifiees > 0 && echecs > 0);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('produit les lignes attendues', () => {
  assert.deepEqual(generateRows(ORDERS, 3, 'orders-2024'), GOLDEN);
});

test('les lignes attendues sont exactement celles du test Python', () => {
  const source = readFileSync(new URL('./n0.test.py', import.meta.url), 'utf8');
  const bloc = /GOLDEN = (\[[\s\S]*?\n\])/.exec(source)[1];
  const enJson = bloc.replaceAll('True', 'true').replaceAll('False', 'false').replace(/,(\s*[}\]])/g, '$1');
  assert.deepEqual(JSON.parse(enJson), GOLDEN);
});

test('Python et JavaScript produisent les mêmes lignes pour la même graine', () => {
  const schemaLarge = {
    ...ORDERS,
    vip: { type: 'bool', true_percent: 3 },
    ancien: { type: 'date', start: '1999-12-31', days: 10_000 },
    grand: { type: 'int', min: -1_000_000, max: 3_000_000_000 },
    unique: { type: 'choice', values: ['seul'] },
    'champ accentué': { type: 'int', min: 0, max: 1 },
  };
  const appels = [[ORDERS, 3, 'orders-2024'], [schemaLarge, 400, 'orders-2024']];
  for (const graine of ['', 'graine-été', 'graine-été'.normalize('NFD'), '🧪 recette',
    '\ufeffBOM', 'a\u200bb', '\u00a0', ...GRAINES_ESSAI]) {
    appels.push([schemaLarge, 60, graine]);
  }
  assert.deepEqual(generateRowsEnPython(appels), appels.map(([s, n, g]) => generateRows(s, n, g)));
});

test('la même graine redonne les mêmes lignes, une autre graine non', () => {
  // The property the whole rung rests on: a seed printed next to a failure is
  // enough to rebuild the data that caused it.
  assert.deepEqual(generateRows(ORDERS, 50, 'orders-2024'), generateRows(ORDERS, 50, 'orders-2024'));
  assert.notDeepEqual(generateRows(ORDERS, 50, 'orders-2024'), generateRows(ORDERS, 50, 'orders-2025'));
});

test('chaque cellule est tirée d’un hachage de graine, champ, ligne', () => {
  const rows = generateRows(ORDERS, 40, 'orders-2024');
  rows.forEach((row, index) => {
    const n = finalise(stableHash(`orders-2024${UNIT}quantity${UNIT}${index}`));
    assert.equal(draw('orders-2024', 'quantity', index), n);
    assert.equal(row.quantity, 1 + (n % 9));
    assert.equal(row.city, ORDERS.city.values[draw('orders-2024', 'city', index) % 4]);
  });
});

test('deux colonnes tirées séparément sont indépendantes', () => {
  // `finalise` : « two columns that should be independent come out perfectly
  // anticorrelated » sans elle. Tableau de contingence sur dix mille lignes :
  // les quatre combinaisons existent, chacune entre 20 % et 30 %.
  const schema = { a: { type: 'choice', values: ['x', 'y'] }, b: { type: 'choice', values: ['x', 'y'] } };
  const table = new Map();
  for (const row of generateRows(schema, 10_000, 's')) {
    const key = `${row.a}${row.b}`;
    table.set(key, (table.get(key) ?? 0) + 1);
  }
  assert.deepEqual([...table.keys()].sort(), ['xx', 'xy', 'yx', 'yy']);
  for (const [key, count] of table) assert.ok(count >= 2000 && count <= 3000, `${key}: ${count}`);
});

test('une colonne à deux valeurs n’a pas de période deux', () => {
  // `finalise` : « one column alternates strictly » sans elle.
  const plans = generateRows({ plan: { type: 'choice', values: ['free', 'pro'] } }, 100, 'demo').map((r) => r.plan);
  const alternances = plans.filter((plan, i) => i > 0 && plan !== plans[i - 1]).length;
  assert.ok(alternances > 30 && alternances < 70, String(alternances));
  // Et une colonne d'entiers sur quatre valeurs n'a pas de période 4.
  const q = generateRows({ q: { type: 'int', min: 1, max: 4 } }, 100, 'demo').map((r) => r.q);
  assert.ok(q.some((value, i) => i >= 4 && value !== q[i - 4]));
});

test('le hachage est le FNV-1a 32 bits de référence', () => {
  assert.equal(stableHash(''), 0x811c9dc5);
  assert.equal(stableHash('a'), 0xe40c292c);
  assert.equal(stableHash('foobar'), 0xbf9cf968);
  for (const mot of ['orders-2024', 'graine-été', '🧪']) assert.equal(stableHash(mot), hashWord(mot));
});

test('une multiplication ordinaire dériverait là où Math.imul reste exact', () => {
  // Commentaire : « a plain `*` on numbers this large loses precision past 2^53 and silently drifts ».
  let naif = 2166136261;
  let exact = 2166136261n;
  for (const char of 'orders-2024') {
    naif = ((naif ^ char.codePointAt(0)) * 16777619) >>> 0;
    exact = ((exact ^ BigInt(char.codePointAt(0))) * 16777619n) & 0xffffffffn;
  }
  assert.notEqual(naif, stableHash('orders-2024'));
  assert.equal(Number(exact), stableHash('orders-2024'));
});

test('le séparateur n’apparaît dans aucune partie de la clé', () => {
  // Commentaires : UNIT « joins the parts of a cell key, and appears in none of
  // them » ; ESCAPE « stands in for UNIT inside a part, and is escaped itself ».
  assert.notEqual(draw('a\u001fb', 'c', 0), draw('a', 'b\u001fc', 0));
  assert.notEqual(draw('a\u001e1', 'c', 0), draw('a\u001f', 'c', 0));
  assert.notEqual(draw('a\u001e', '1c', 0), draw('a', '\u001e1c', 0));
  // part n'est pas exporté : toutes les paires (graine, champ) de deux caractères
  // au plus sur {a, 0, 1, U+001E, U+001F} donnent des tirages distincts.
  const alphabet = ['a', '0', '1', '\u001e', '\u001f'];
  const textes = ['', ...alphabet, ...alphabet.flatMap((x) => alphabet.map((y) => x + y))];
  const tirages = new Set(textes.flatMap((s) => textes.map((f) => draw(s, f, 0))));
  assert.equal(tirages.size, textes.length ** 2);
});

test('l’échappement est sans effet sur une graine et un champ ordinaires', () => {
  for (const [graine, champ, ligne] of [['orders-2024', 'city', 0], ['', '', 7], ['🧪 été', 'montant', 49_999]]) {
    assert.equal(draw(graine, champ, ligne), finalise(stableHash(`${graine}${UNIT}${champ}${UNIT}${ligne}`)));
  }
  assert.deepEqual(generateRows(ORDERS, 3, 'orders-2024'), GOLDEN);
});

test('le générateur ne lit que le schéma et la graine, et une valeur réelle du schéma ressort telle quelle', () => {
  // risks.regulatory : « le générateur ne lit que le schéma et la graine, et une valeur
  // réelle écrite dans le schéma, choix ou préfixe, ressort telle quelle dans les lignes ».
  const schema = {
    client: { type: 'choice', values: ['Jeanne Dupont'] },
    email: { type: 'sequence', prefix: 'jeanne.dupont+', suffix: '@exemple.fr', width: 2 },
    ville: { type: 'choice', values: ['Paris', 'Lyon'] },
  };
  const rows = generateRows(schema, 5, 'recette');
  assert.deepEqual(new Set(rows.map((r) => r.client)), new Set(['Jeanne Dupont']));
  assert.deepEqual(rows.map((r) => r.email), [1, 2, 3, 4, 5].map((i) => `jeanne.dupont+0${i}@exemple.fr`));
  assert.deepEqual(generateRows(schema, 5, 'recette'), rows);
  assert.deepEqual(generateRows(schema, 5, 'autre').map((r) => r.email), rows.map((r) => r.email));
});

test('Math.random de JavaScript ne prend pas de graine', () => {
  // Docstring : « JavaScript's `Math.random` does not » (take a seed). Il ne déclare
  // aucun paramètre, et un argument ne le rend pas répétable.
  assert.equal(Math.random.length, 0);
  const tirage = () => Array.from({ length: 3 }, () => Math.random(42));
  assert.notDeepEqual(tirage(), tirage());
});

test('agrandir le jeu le prolonge au lieu de le retirer', () => {
  // Asking for more rows keeps the ones already there, so a fixture can grow
  // without invalidating the expectations written against it.
  assert.deepEqual(generateRows(ORDERS, 20, 'orders-2024').slice(0, 5), generateRows(ORDERS, 5, 'orders-2024'));
});

test('ajouter un champ laisse les autres colonnes intactes', () => {
  const before = generateRows(ORDERS, 10, 'orders-2024');
  const wider = { ...ORDERS, discount: { type: 'bool', true_percent: 10 } };
  const after = generateRows(wider, 10, 'orders-2024').map(({ discount, ...rest }) => rest);
  assert.deepEqual(after, before);
  // Placé en tête plutôt qu'à la fin, le nouveau champ ne décale rien non plus.
  const first = generateRows({ discount: { type: 'bool' }, ...ORDERS }, 10, 'orders-2024')
    .map(({ discount, ...rest }) => rest);
  assert.deepEqual(first, before);
});

test('chaque ligne respecte le schéma', () => {
  const rows = generateRows(ORDERS, 300, 'orders-2024');
  assert.equal(rows.length, 300);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), Object.keys(ORDERS).sort());
    assert.ok(row.quantity >= 1 && row.quantity <= 9);
    assert.ok(ORDERS.city.values.includes(row.city));
    assert.ok(row.signed_up_on >= '2024-01-01' && row.signed_up_on <= '2024-12-30');
    assert.equal(typeof row.newsletter, 'boolean');
  }
});

test('un identifiant de séquence est unique par construction', () => {
  const ids = generateRows({ id: { type: 'sequence', prefix: 'C-', width: 2 } }, 20_000, 's').map((r) => r.id);
  assert.equal(new Set(ids).size, 20_000);
  // Au-delà de la largeur, le rang s'allonge au lieu d'être tronqué.
  assert.deepEqual(ids.slice(98, 101), ['C-99', 'C-100', 'C-101']);
});

test('les booléens se lisent en pourcentage, pas en probabilité', () => {
  const part = (p) => generateRows({ b: { type: 'bool', true_percent: p } }, 10_000, 's')
    .filter((r) => r.b).length / 10_000;
  assert.ok(part(30) > 0.28 && part(30) < 0.32);
  // Qui recopie une probabilité (0,3) obtient presque aucun vrai, sans erreur.
  assert.ok(part(0.3) < 0.02);
});

test('une contrainte impossible est refusée plutôt que contournée', () => {
  assert.throws(() => generateRows({ age: { type: 'int', min: 80, max: 18 } }, 1, 'seed'), RangeError);
  assert.throws(() => generateRows({ city: { type: 'choice', values: [] } }, 1, 'seed'), RangeError);
  assert.throws(() => generateRows({ city: { type: 'postcode' } }, 1, 'seed'), RangeError);
});

test('aucun fichier écrit', () => {
  const noms = ['writeFileSync', 'writeFile', 'openSync', 'open', 'createWriteStream', 'appendFileSync'];
  const origines = Object.fromEntries(noms.map((n) => [n, fs[n]]));
  let rows;
  try {
    for (const n of noms) {
      fs[n] = () => {
        throw new Error('un fichier a été ouvert');
      };
    }
    syncBuiltinESMExports();
    rows = generateRows(ORDERS, 50, 'orders-2024');
  } finally {
    Object.assign(fs, origines);
    syncBuiltinESMExports();
  }
  assert.equal(rows.length, 50);
});

test('trois lignes prennent moins d’une milliseconde', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) generateRows(ORDERS, 3, 'orders-2024');
  assert.ok(performance.now() - debut < 1000);
});

test('l’essai : une autre graine donne d’autres villes, d’autres quantités, d’autres dates', () => {
  const [a, b] = ['commandes-2024', 'commandes-2025'].map((g) => essai.run(g, 'fr').rows.rows);
  const colonnes = essai.run('commandes-2024', 'fr').rows.columns;
  for (const champ of ['city', 'quantity', 'signed_up_on']) {
    const k = colonnes.indexOf(champ);
    assert.notDeepEqual(a.map((l) => l[k]), b.map((l) => l[k]), champ);
  }
});

test('l’essai : sur cinq cents lignes, aucune étiquette, aucune majuscule, aucune apostrophe', () => {
  for (const cas of essai.cases) {
    const { verdict } = essai.run(cas.input, 'fr');
    assert.equal(verdict.label, '500 adresses tirées de cette graine, une seule forme');
    assert.equal(verdict.detail, '0 avec une étiquette après un +, 0 avec une majuscule, 0 avec une apostrophe.');
  }
});

test('l’essai : la note dit « en JavaScript comme en Python, tant que le code de la fiche ne change pas »', () => {
  assert.match(essai.run('incident-4471', 'fr').note, /en JavaScript comme en Python, tant que le code de la fiche ne change pas/);
  assert.match(essai.run('incident-4471', 'en').note, /in JavaScript as in Python, for as long as this entry’s code is left unchanged/);
});

test('l’essai : le tableau est celui de l’extrait, et la graine le redonne identique', () => {
  const { rows } = essai.run('incident-4471', 'fr');
  const attendu = generateRows(ORDERS, 5, 'incident-4471');
  assert.deepEqual(rows.columns, Object.keys(ORDERS));
  assert.deepEqual(
    rows.rows,
    attendu.map((l) => rows.columns.map((c) => (l[c] === true ? 'oui' : l[c] === false ? 'non' : String(l[c])))),
  );
  assert.deepEqual(essai.run('incident-4471', 'fr').rows, rows);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : schéma vide, zéro ligne, une ligne et nombre négatif', () => {
  assert.deepEqual(generateRows({}, 3, 'seed'), [{}, {}, {}]);
  assert.deepEqual(generateRows(ORDERS, 0, 'seed'), []);
  assert.equal(generateRows(ORDERS, 1, 'seed').length, 1);
  assert.deepEqual(generateRows(ORDERS, -5, 'seed'), []);
});

test('production : graine vide', () => {
  const rows = generateRows(ORDERS, 3, '');
  assert.deepEqual(rows, generateRows(ORDERS, 3, ''));
  assert.equal(rows.length, 3);
});

test('production : cinquante mille lignes terminent vite', () => {
  const debut = performance.now();
  const rows = generateRows(ORDERS, 50_000, 'orders-2024');
  assert.ok(performance.now() - debut < 10_000);
  assert.equal(new Set(rows.map((r) => r.order_id)).size, 50_000);
});

test('production : NFC et NFD de la même graine donnent deux jeux', () => {
  const nfc = 'recette-été'.normalize('NFC');
  const nfd = 'recette-été'.normalize('NFD');
  assert.notDeepEqual(generateRows(ORDERS, 20, nfc), generateRows(ORDERS, 20, nfd));
  assert.deepEqual(generateRows(ORDERS, 20, nfc), generateRows(ORDERS, 20, 'recette-été'));
});

test('production : emoji, insécable, largeur nulle et BOM dans la graine', () => {
  for (const graine of ['🧪', 'a\u00a0b', 'a\u200bb', '\ufeffseed', 'SEED']) {
    const rows = generateRows(ORDERS, 10, graine);
    assert.equal(rows.length, 10);
    assert.deepEqual(rows, generateRows(ORDERS, 10, graine));
  }
  assert.notDeepEqual(generateRows(ORDERS, 10, 'SEED'), generateRows(ORDERS, 10, 'seed'));
});

test('production : valeurs aux limites', () => {
  const valeurs = (spec, n = 50) => new Set(generateRows({ v: spec }, n, 's').map((r) => r.v));
  assert.deepEqual(valeurs({ type: 'int', min: 7, max: 7 }), new Set([7]));
  assert.deepEqual(valeurs({ type: 'bool', true_percent: 0 }, 500), new Set([false]));
  assert.deepEqual(valeurs({ type: 'bool', true_percent: 100 }, 500), new Set([true]));
  assert.deepEqual(valeurs({ type: 'choice', values: ['x'] }), new Set(['x']));
  assert.deepEqual(valeurs({ type: 'date', start: '2024-02-29' }), new Set(['2024-02-29']));
  assert.deepEqual(valeurs({ type: 'date', start: '2024-02-28', days: 2 }), new Set(['2024-02-28', '2024-02-29']));
});

test('production : une durée nulle, négative ou non entière est refusée', () => {
  // Refus nommé : « a date field needs a whole number of days from 1 » ; days à 1 accepté.
  for (const days of [0, -5, 1.5, '3']) {
    assert.throws(
      () => generateRows({ d: { type: 'date', start: '2024-01-01', days } }, 3, 's'),
      { name: 'RangeError', message: /whole number of days from 1/ },
    );
  }
  assert.deepEqual(generateRows({ d: { type: 'date', start: '2024-01-01', days: 1 } }, 2, 's'), [{ d: '2024-01-01' }, { d: '2024-01-01' }]);
});

test('production : un champ sans type lève une erreur', () => {
  assert.throws(() => generateRows({ d: {} }, 1, 's'), /unknown field type undefined/);
});
