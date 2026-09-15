/**
 * These tests inject a local double instead of running a real engine.
 *
 * What they prove: the engine is called with the page it was given, the
 * reading is decoded and cleaned, a low confidence sends the page to a human
 * without losing the text, a failed call is retried, and an answer that is not
 * a reading never passes for one.
 *
 * What they do not prove: that the engine reads the pixels correctly. That is
 * why this snippet is declared `verification: stubbed` on the entry, and why
 * the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { FakeOCR } from '../_harness/fake-model.mjs';
import { DEFAULT_MIN_CONFIDENCE, LANGUAGE, OCRUnavailable, clean, readPage } from './n2.js';
import essai from '../../tryouts/frozen/read-text-from-a-scanned-page.js';

const PAGE = 'scan-page-1.png';

// What an engine gives back on a clean office scan: the text, with the ragged
// spacing of a page that was photographed rather than typeset.
const READING =
  'NORD FOURNITURES SAS\n' +
  '   N° 2024-000431\n' +
  '\n' +
  '   Émise le 3 avril 2024\n' +
  'NET A PAYER    92,40 EUR\n';

// The shape of the invoice references, the hand-written rule the entry sends
// the reader back to.
const REFERENCE = /\b\d{4}-\d{6}\b/;

/** An engine that drops a call, the way a busy worker process does. */
class FlakyEngine {
  constructor(engine, failures = 1) {
    this.engine = engine;
    this.failures = failures;
    this.calls = 0;
  }

  async read(imagePath) {
    this.calls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('the worker was not ready');
    }
    return this.engine.read(imagePath);
  }
}

/*
 * Un faux module `tesseract.js`, à la forme de la version publiée (v6) :
 * `createWorker(langs)` rend un worker dont `recognize(image)` rend
 * `{ data: { text, blocks: null, … } }`. Depuis la v6, seules les sorties
 * texte sont rendues par défaut : il n'y a plus de `data.words`.
 * Le module est servi par un crochet de résolution, parce que l'extrait
 * l'importe dynamiquement et que le paquet n'est pas installé.
 */
const FAUX_TESSERACT = `
export async function createWorker(langs) {
  globalThis.__tesseract.workers.push(langs);
  return {
    async recognize(image) {
      globalThis.__tesseract.images.push(image);
      return { jobId: 'job', data: { text: 'NORD FOURNITURES SAS\\nN° 2024-000431\\n', blocks: null, hocr: null, tsv: null } };
    },
    async terminate() { globalThis.__tesseract.terminated += 1; },
  };
}`;
globalThis.__tesseract = { workers: [], images: [], terminated: 0 };
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'tesseract.js') {
    return { url: 'data:text/javascript,' + ${JSON.stringify(encodeURIComponent(FAUX_TESSERACT))}, shortCircuit: true };
  }
  return next(specifier, context);
}`)}`);

function cleanEnPython(textes) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const r = spawnSync(python, ['-c',
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n2 import clean; json.dump([clean(t) for t in json.load(sys.stdin)], sys.stdout)',
    fileURLToPath(new URL('.', import.meta.url))], { input: JSON.stringify(textes), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une lecture fausse et sûre d’elle laisse le drapeau baissé', async () => {
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2O24-OOO431' }, 0.96));
  assert.deepEqual(result, { text: 'N° 2O24-OOO431', confidence: 0.96, review: false });
  assert.ok(!result.text.includes('2024-000431'));
});

test('point de rupture : un seuil ne distingue pas une lecture fausse d’une juste au même score', async () => {
  for (let centiemes = 0; centiemes <= 100; centiemes += 1) {
    const minConfidence = centiemes / 100;
    const fausse = await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2O24-OOO431' }, 0.96), { minConfidence });
    const juste = await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2024-000431' }, 0.96), { minConfidence });
    assert.equal(fausse.review, juste.review, String(minConfidence));
  }
  assert.equal((await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.41))).review, true);
});

test('INFIRMÉ : relever le seuil ne change rien', async () => {
  // À 0,97 le drapeau se lève — sur la lecture fausse comme sur toute lecture juste à 0,96.
  await assert.rejects(async () => {
    for (let centiemes = 70; centiemes < 100; centiemes += 1) {
      const result = await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2O24-OOO431' }, 0.96), { minConfidence: centiemes / 100 });
      assert.equal(result.review, false, String(centiemes));
    }
  });
});

test('point de rupture : témoin, une règle sur la forme des références rattrape la faute', async () => {
  const fausse = (await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2O24-OOO431' }, 0.96))).text;
  const juste = (await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.94))).text;
  assert.equal(REFERENCE.exec(fausse), null);
  assert.equal(REFERENCE.exec(juste)[0], '2024-000431');
});

// ---------------------------------------------------------------------------
// Le vrai moteur, contre un double à la forme de tesseract.js
// ---------------------------------------------------------------------------

test('le moteur par défaut lit la page avec la forme publiée de tesseract.js', async () => {
  // `data.words` n'existe plus par défaut depuis tesseract.js v6 : `read`
  // lève TypeError, l'appel est retenté, et readPage lève OCRUnavailable.
  globalThis.__tesseract = { workers: [], images: [], terminated: 0 };
  const result = await readPage(PAGE);
  assert.ok(result.text.includes('NORD FOURNITURES SAS'));
  assert.equal(globalThis.__tesseract.workers[0], LANGUAGE);
  assert.equal(LANGUAGE, 'fra');
});

test('INFIRMÉ : le moteur par défaut est démarré une fois pour le processus', async () => {
  // readPage sans moteur appelle TesseractOCR.load() à chaque page : un worker
  // neuf par page, jamais terminé.
  globalThis.__tesseract = { workers: [], images: [], terminated: 0 };
  await readPage('page-1.png').catch(() => {});
  await readPage('page-2.png').catch(() => {});
  assert.throws(() => assert.equal(globalThis.__tesseract.workers.length, 1));
  assert.equal(globalThis.__tesseract.terminated, 0);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit la page', async () => {
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.94));
  assert.deepEqual(result.text.split('\n'), ['NORD FOURNITURES SAS', 'N° 2024-000431', 'Émise le 3 avril 2024', 'NET A PAYER 92,40 EUR']);
  assert.equal(result.confidence, 0.94);
  assert.equal(result.review, false);
});

test('remet au moteur la page qu’on lui a donnée', async () => {
  const engine = new FakeOCR({ [PAGE]: READING });
  await readPage(PAGE, engine);
  assert.deepEqual(engine.calls, [PAGE]);
});

test('recolle un mot que le scan a coupé', async () => {
  const engine = new FakeOCR({ [PAGE]: 'un second exem-\nplaire de la facture' });
  assert.equal((await readPage(PAGE, engine)).text, 'un second exemplaire de la facture');
});

test('Python et JavaScript recollent les mêmes mots', () => {
  // `\w` sans drapeau u ne reconnaît que l'ASCII : « réfé-\nrence » reste coupé ici.
  const textes = ['réfé-\nrence', 'ache-\ntée', 'exem-\nplaire', 'N°  2024\n\n  NET\u00a0A PAYER'];
  assert.deepEqual(cleanEnPython(textes), textes.map(clean));
});

test('une confiance basse garde le texte et demande un humain', async () => {
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.41));
  assert.ok(result.text.includes('NORD FOURNITURES SAS'));
  assert.equal(result.confidence, 0.41);
  assert.equal(result.review, true);
});

test('le seuil par défaut, juste au-dessus et juste en dessous', async () => {
  assert.equal(DEFAULT_MIN_CONFIDENCE, 0.7);
  assert.equal((await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.7))).review, false);
  assert.equal((await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.6999))).review, true);
});

test('une page blanche est signalée quelle que soit l’assurance du moteur', async () => {
  assert.deepEqual(await readPage(PAGE, new FakeOCR({}, 0.99)), { text: '', confidence: 0.99, review: true });
});

for (const valeur of ['high', true, null, Number.NaN, 1.5, -0.1, 94]) {
  test(`une confiance qui n’est pas un nombre entre zéro et un n’est pas une confiance (${String(valeur)})`, async () => {
    const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, valeur));
    assert.equal(result.confidence, 0);
    assert.equal(result.review, true);
  });
}

test('réessaie un appel tombé et abandonne après la dernière tentative', async () => {
  let engine = new FlakyEngine(new FakeOCR({ [PAGE]: READING }));
  assert.ok((await readPage(PAGE, engine)).text.includes('NORD FOURNITURES SAS'));
  assert.equal(engine.calls, 2);
  engine = new FlakyEngine(new FakeOCR({ [PAGE]: READING }), 5);
  await assert.rejects(() => readPage(PAGE, engine, { attempts: 2 }), (e) => e instanceof OCRUnavailable && /not ready/.test(e.message));
  assert.equal(engine.calls, 2);
});

test('production : zéro tentative lève sans appeler', async () => {
  const engine = new FlakyEngine(new FakeOCR({ [PAGE]: READING }), 0);
  await assert.rejects(() => readPage(PAGE, engine, { attempts: 0 }), OCRUnavailable);
  assert.equal(engine.calls, 0);
});

for (const reponse of ['NORD FOURNITURES SAS', { confidence: 0.9 }, { text: null }, { text: 42 }, null]) {
  test(`une réponse qui n’est pas une lecture lève (${JSON.stringify(reponse)})`, async () => {
    await assert.rejects(() => readPage(PAGE, { read: async () => reponse }), OCRUnavailable);
  });
}

test('déterministe : la même lecture donne le même résultat', async () => {
  assert.deepEqual(await readPage(PAGE, new FakeOCR({ [PAGE]: READING })), await readPage(PAGE, new FakeOCR({ [PAGE]: READING })));
});

test('l’essai rend ce que ses cas annoncent', async () => {
  const sortie = async (i, lang) => essai.run(essai.cases[i].input, lang, essai.cases[i]);
  const nette = await sortie(0, 'fr');
  assert.equal(nette.output.split('\n')[1], 'N° 2024-000431');
  assert.match(nette.note, /^Confiance 0,94, au-dessus du seuil de 0,7 : la page est classée sans relecture\. Un appel/);
  assert.match((await sortie(1, 'fr')).output, /second exemplaire/);
  assert.match((await sortie(1, 'en')).output, /second duplicate/);
  assert.match((await sortie(2, 'fr')).note, /^Confiance 0,41, sous le seuil de 0,7 : le texte est gardé et la page part en relecture humaine/);
  const verso = await sortie(3, 'fr');
  assert.equal(verso.output, '');
  assert.match(verso.note, /n’a pourtant rendu aucun texte : la page part en relecture/);
  assert.match((await sortie(4, 'fr')).note, /^Le premier appel est tombé, le second a répondu\. .* 2 appels/);
  const confiante = await sortie(5, 'fr');
  assert.ok(essai.cases[5].fails);
  assert.match(confiante.output, /2O24-OOO431/);
  assert.match(confiante.note, /au-dessus du seuil/);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : nettoyer une lecture vide reste vide', () => {
  assert.equal(clean(''), '');
  assert.equal(clean('   \n\n \t \n'), '');
});

test('production : espaces insécables, fins de ligne Windows, NFD, emoji et BOM', () => {
  const lecture = 'NORD\u00a0\u00a0FOURNITURES\r\n\ufeffN° 2024\r\ncafe\u0301 🧾\r\n';
  assert.deepEqual(clean(lecture).split('\n'), ['NORD FOURNITURES', 'N° 2024', 'cafe\u0301 🧾']);
});

test('production : une lecture d’un mégaoctet se nettoie vite', async () => {
  const lecture = 'NET A PAYER    92,40 EUR   exem-\nplaire\n\n'.repeat(30_000);
  const debut = performance.now();
  const { text } = await readPage(PAGE, new FakeOCR({ [PAGE]: lecture }));
  assert.ok(performance.now() - debut < 5000);
  assert.equal(text.split('exemplaire').length - 1, 30_000);
});

test('une référence coupée en fin de ligne garde son trait d’union', async () => {
  // « N° 2024-\n000431 » devient « 2024000431 ».
  const { text } = await readPage(PAGE, new FakeOCR({ [PAGE]: 'Facture N° 2024-\n000431' }, 0.95));
  assert.ok(REFERENCE.test(text.replace('\n', '')));
});
