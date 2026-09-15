/**
 * Tests du niveau N1 : inférence du type de colonne par régression logistique,
 * écrite à la main. Les colonnes étiquetées vivent ici, jamais dans l'extrait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanCsv } from './n0.js';
import { FEATURE_NAMES, classify, columnFeatures, inferSchema, train } from './n1.js';

const LABELLED = {
  integer: [
    ['1', '2', '3', '4', '5', '6'],
    ['1024', '2048', '4096', '8192'],
    ['12', '7', '103', '5', '88', '41'],
    ['-3', '14', '0', '27', '5'],
  ],
  number: [
    ['1.5', '2.75', '3.0', '4.25'],
    ['12,50', '0,99', '1234,56', '7,10'],
    ['-0.5', '10.25', '3.75', '0.1'],
    ['100.0', '250.5', '99.99', '12.30'],
  ],
  date: [
    ['2023-04-12', '2023-05-01', '2024-01-09'],
    ['01/05/2023', '12/11/2022', '30/06/2021'],
    ['09.01.2024', '28.02.2023', '15.07.2022'],
    ['2020-12-31', '2021-01-01', '2022-06-15', '2023-03-03'],
  ],
  boolean: [
    ['yes', 'no', 'yes', 'no', 'yes'],
    ['true', 'false', 'true', 'true', 'false'],
    ['0', '1', '1', '0', '1', '0'],
    ['oui', 'non', 'oui', 'non'],
  ],
  text: [
    ['Alice', 'Bob', 'Carol', 'Dan'],
    ['Paris', 'Lyon', 'Marseille', 'Lille'],
    ['a short note', 'another note here', 'something else entirely'],
    ['AB1', 'CD2', 'EF3', 'GH4'],
    ['thé vert', 'café au lait', "jus d'orange"],
  ],
};

const COLUMNS = Object.values(LABELLED).flat();
const LABELS = Object.entries(LABELLED).flatMap(([kind, columns]) => columns.map(() => kind));

const HEADER = ['id', 'name', 'joined', 'amount', 'active'];
const ROWS = [
  ['1', 'Alice', '2023-04-12', '12.50', 'yes'],
  ['2', 'Bob', '2023-05-01', '3.99', 'no'],
  ['3', 'Carol', '2023-06-30', '120.00', 'yes'],
  ['4', 'Dan', '2023-07-14', '7.25', 'no'],
  ['5', 'Eve', '2023-08-02', '45.10', 'yes'],
];

const MODEL = train(COLUMNS, LABELS);
const SOURCE = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
const repeat = (values, n) => Array.from({ length: n }, (_, i) => values[i % values.length]);

/** Lignes de code d'une fonction, hors lignes vides et commentaires seuls. */
function codeLines(signature) {
  const start = SOURCE.indexOf(signature);
  const end = SOURCE.indexOf('\n}\n', start);
  return SOURCE.slice(start, end + 2).split('\n').filter((l) => l.trim() !== '' && !/^\s*\/\//.test(l)).length;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un identifiant fait de chiffres', () => {
  const postcodes = ['01000', '06400', '75014', '02100', '13008'];
  assert.equal(classify(MODEL, postcodes), 'integer');
  const result = cleanCsv(Buffer.from('postcode\n01000\n06400\n75014\n'), { postcode: classify(MODEL, postcodes) });
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.rows.map((row) => row.postcode), [1000, 6400, 75014]);
  // Témoin : les mêmes codes portant une lettre sont du texte, et gardent leur zéro.
  assert.equal(classify(MODEL, ['F-01000', 'F-06400', 'F-75014', 'F-02100', 'F-13008']), 'text');
  assert.deepEqual(cleanCsv(Buffer.from('postcode\nF-01000\n'), { postcode: 'text' }).rows, [{ postcode: 'F-01000' }]);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires
// ---------------------------------------------------------------------------

test('n1 est une régression logistique écrite à la main', () => {
  // « Written out rather than pulled from a library » ; « One regression is fitted per type ».
  assert.doesNotMatch(SOURCE, /\bimport\b|\brequire\(/);
  assert.deepEqual(MODEL.kinds, ['boolean', 'date', 'integer', 'number', 'text']);
  assert.equal(MODEL.models.length, 5);
  assert.ok(MODEL.models.every((m) => m.weights.length === 8));
});

test('INFIRMÉ : « logistic regression on eight features is thirty lines » ; fitOne, train et classify en comptent 38', () => {
  const lines = codeLines('function fitOne') + codeLines('export function train') + codeLines('export function classify');
  assert.equal(lines, 38);
  assert.throws(() => assert.ok(lines <= 30), assert.AssertionError);
});

test('la réponse la plus forte l’emporte', () => {
  const features = columnFeatures(['2023-04-12', '2024-01-09']);
  const scores = MODEL.models.map(({ weights, bias }) => weights.reduce((z, w, j) => z + w * features[j], bias));
  assert.equal(classify(MODEL, ['2023-04-12', '2024-01-09']), MODEL.kinds[scores.indexOf(Math.max(...scores))]);
});

test('infère le schéma d’un fichier que personne n’a documenté', () => {
  assert.deepEqual(inferSchema(MODEL, HEADER, ROWS), { id: 'integer', name: 'text', joined: 'date', amount: 'number', active: 'boolean' });
});

test('le schéma inféré est celui que N0 prend', () => {
  const data = Buffer.from(
    'id,name,joined,amount,active\n1,Alice,2023-04-12,12.50,yes\n2,Bob,2023-05-01,3.99,no\n' +
      '3,Carol,2023-06-30,120.00,yes\n4,Dan,2023-07-14,7.25,no\n5,Eve,2023-08-02,45.10,yes\n',
  );
  const result = cleanCsv(data, inferSchema(MODEL, HEADER, ROWS));
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.rows[0], { id: 1, name: 'Alice', joined: '2023-04-12', amount: 12.5, active: true });
});

test('huit traits, tous entre zéro et un', () => {
  const features = columnFeatures(['12', '7', '103']);
  assert.equal(features.length, 8);
  assert.equal(FEATURE_NAMES.length, 8);
  assert.ok(features.every((value) => value >= 0 && value <= 1));
  assert.equal(features[0], 1);
  assert.equal(features[3], 0);
  assert.equal(columnFeatures(['x'.repeat(500), 'y'.repeat(800)])[6], 1);
  assert.equal(columnFeatures(['x'.repeat(20)])[6], 1);
  assert.equal(columnFeatures(['x'.repeat(10)])[6], 0.5);
});

test('les traits de forme ne dépendent pas de la taille de l’échantillon', () => {
  const features = columnFeatures(['12', '7', '103']);
  assert.deepEqual(columnFeatures(['12', '7', '103', '44', '9', '271']).slice(0, 5), features.slice(0, 5));
});

test('INFIRMÉ : « described on the same scale » ; la colonne 0, 1, 2, 3 est integer sur 8 lignes, boolean sur 200', () => {
  assert.throws(() => {
    assert.equal(classify(MODEL, repeat(['0', '1', '2', '3'], 8)), classify(MODEL, repeat(['0', '1', '2', '3'], 200)));
  }, assert.AssertionError);
});

test('les valeurs vides sont mises de côté et comptées à part', () => {
  const withBlanks = columnFeatures(['2023-04-12', '', '  ', '2024-01-09']);
  assert.deepEqual(withBlanks.slice(0, 7), columnFeatures(['2023-04-12', '2024-01-09']).slice(0, 7));
  assert.equal(withBlanks[7], 0.5);
});

test('les colonnes où il n’y a presque rien', () => {
  assert.equal(classify(null, ['', '  ', '']), 'text');
  assert.equal(classify(null, []), 'text');
  assert.equal(classify(MODEL, ['2023-04-12', '', '', '2024-01-09', '']), 'date');
  assert.equal(classify(MODEL, ['2023-04-12']), 'date');
});

test('INFIRMÉ : « A couple of hundred rows say as much […] as a million do » ; des entiers puis des décimaux restent integer', () => {
  const rows = [...Array.from({ length: 200 }, (_, i) => [String(i + 1)]), ...Array(50).fill(['12.50'])];
  assert.throws(() => {
    assert.deepEqual(inferSchema(MODEL, ['amount'], rows), inferSchema(MODEL, ['amount'], rows.slice(150)));
  }, assert.AssertionError);
});

test('l’échantillon est de deux cents lignes et les lignes courtes comptent vide', () => {
  assert.deepEqual(inferSchema(MODEL, ['id', 'name'], [['1', 'Alice'], ['2']]), { id: 'integer', name: 'text' });
  assert.deepEqual(inferSchema(MODEL, ['id'], [...Array.from({ length: 200 }, (_, i) => [String(i)]), ...Array(1000).fill(['abc'])]), { id: 'integer' });
});

test('n1 est déterministe', () => {
  const again = train(COLUMNS, LABELS);
  assert.deepEqual(again, MODEL);
});

test('deux cents colonnes s’infèrent de l’ordre de dix millisecondes', () => {
  // latency « ~10 ms » : 18 ms mesurés en JavaScript ; infirmé en Python (45 ms).
  const header = Array.from({ length: 200 }, (_, i) => `c${i}`);
  const rows = Array.from({ length: 200 }, (_, j) => header.map((_, i) => (i % 3 === 0 ? String((j * i) % 97) : i % 3 === 1 ? '2023-04-12' : 'Alice')));
  inferSchema(MODEL, header, rows);
  let best = Infinity;
  for (let r = 0; r < 3; r += 1) {
    const start = performance.now();
    inferSchema(MODEL, header, rows);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 32, `${best} ms`);
});

test('verdict : N1 devine le schéma que N0 réclame', () => {
  const schema = inferSchema(MODEL, ['id', 'joined'], [['1', '2023-04-12'], ['2', '31/02/2024']]);
  assert.deepEqual(schema, { id: 'integer', joined: 'date' });
  const rejects = cleanCsv(Buffer.from('id,joined\n1,2023-04-12\n2,31/02/2024\n'), schema).rejects;
  assert.deepEqual(rejects.map((r) => [r.line, r.reason]), [[3, 'not a real date']]);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('DÉFAUT : un jeu d’entraînement vide donne un modèle qui rend undefined', () => {
  // Python lève ValueError (jeu vide, ou une seule classe).
  assert.throws(() => {
    let model;
    try {
      model = train([], []);
    } catch {
      return;
    }
    assert.equal(typeof classify(model, ['1', '2']), 'string');
  }, assert.AssertionError);
});

test('production : deux cents colonnes de deux mille lignes terminent', () => {
  const header = Array.from({ length: 200 }, (_, i) => `c${i}`);
  const rows = Array.from({ length: 2000 }, () => Array(200).fill('1'));
  const start = performance.now();
  assert.deepEqual(new Set(Object.values(inferSchema(MODEL, header, rows))), new Set(['boolean']));
  assert.ok(performance.now() - start < 5000);
});

test('production : encodage NFD, emoji, insécables', () => {
  assert.equal(classify(MODEL, ['Zoé', 'Anaïs', 'Léon 🙂'].map((n) => n.normalize('NFD'))), 'text');
  assert.equal(classify(MODEL, ['1\u00a0234,50', '12,00', '7\u202f000,25']), 'number');
});

test('production : échantillon nul', () => {
  assert.deepEqual(inferSchema(MODEL, HEADER, ROWS, 0), Object.fromEntries(HEADER.map((name) => [name, 'text'])));
});
