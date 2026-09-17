/**
 * These tests inject a local double instead of loading the real model.
 *
 * What they prove: the page is sent in one pass with its lines in order, the
 * scores are decoded into fields, the threshold sends a doubtful field to a
 * human, an oversized document is refused before the model runs, a failed pass
 * is retried, and an unusable answer never passes for a reading.
 *
 * What they do not prove: that the model tags the right lines. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import {
  DEFAULT_THRESHOLD,
  ExtractionUnavailable,
  LayoutModel,
  MAX_LINES,
  MODEL_NAME,
  boxesFor,
  extractFields,
} from './n2.js';

const LINES = [
  'NORD FOURNITURES SAS',
  '                            N° 2024-000431',
  '                            Émise le 3 avril 2024',
  'Cartouche encre noire            2    38,50      77,00',
  '                    Sous-total                     77,00',
  '                    TVA (20 %)                     15,40',
  '                    NET A PAYER                    92,40 EUR',
];
const INVOICE = LINES.join('\n');

// The labels are the ones an invoice model exposes; the scores are ours, so the
// test exercises our thresholds and not the model's opinions.
const SCORES = {
  [LINES[1]]: { invoice_number: 0.97, date: 0.11 },
  [LINES[2]]: { date: 0.95 },
  [LINES[6]]: { total: 0.93, invoice_number: 0.02 },
};

const DEPOSIT = [
  'VERRERIE DU CENTRE',
  'Facture V-2451 du 12/09/2024',
  'Bocaux 500 ml x 200                          264,00',
  'Total TTC                                    360,00 €',
  'Acompte versé le 02/09                       120,00 €',
  'Solde à régler                               240,00 €',
];
const DEPOSIT_SCORES = { [DEPOSIT[4]]: { total: 0.96 }, [DEPOSIT[3]]: { total: 0.41 } };

/** A model that drops a pass, the way a machine under load does. */
class FlakyModel {
  constructor(model, failures = 1) {
    this.model = model;
    this.failures = failures;
    this.passes = 0;
  }

  async predict(lines) {
    this.passes += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('the model was not ready');
    }
    return this.model.predict(lines);
  }
}

/**
 * The surface of `pipeline('token-classification', …)` in
 * @huggingface/transformers: called with a string or a list of strings, it
 * answers one object per token, `entity`, `score`, `index`, `word`
 * (`entity_group` only with `aggregation_strategy: 'simple'`). A dict of words
 * and boxes is not an input it takes.
 */
async function realShapedTokenPipeline(texts) {
  const list = typeof texts === 'string' ? [texts] : texts;
  if (!Array.isArray(list) || !list.every((t) => typeof t === 'string')) {
    throw new TypeError('token-classification takes text, not words and boxes');
  }
  return list.map((t) => [{ entity: 'total', score: 0.9, index: 1, word: t.split(' ')[0] }]);
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une ligne d’acompte bien notée revient avec un nombre, un bon score et aucun drapeau', async () => {
  // Que le modèle réel note ainsi la ligne d'acompte n'est pas testable ici :
  // le score est écrit par le double.
  const { total } = await extractFields(DEPOSIT.join('\n'), new FakeClassifier(DEPOSIT_SCORES));
  assert.deepEqual(total, { value: 120, score: 0.96, review: false });
  // Witness: the same line scored low goes to review.
  const doubtful = await extractFields(DEPOSIT.join('\n'), new FakeClassifier({ [DEPOSIT[4]]: { total: 0.5 } }));
  assert.equal(doubtful.total.review, true);
});

test('point de rupture : relever le seuil ne change pas la valeur lue', async () => {
  for (const threshold of [0.8, 0.9, 0.95, 0.99]) {
    const { total } = await extractFields(DEPOSIT.join('\n'), new FakeClassifier(DEPOSIT_SCORES), { threshold });
    assert.equal(total.value, 120);
  }
});

test('INFIRMÉ : la fiche dit que relever le seuil n’y change rien, au-dessus de 0,96 le champ part en relecture', async () => {
  await assert.rejects(async () => {
    const { total } = await extractFields(DEPOSIT.join('\n'), new FakeClassifier(DEPOSIT_SCORES), { threshold: 0.97 });
    assert.equal(total.review, false);
  });
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit les trois champs', async () => {
  const fields = await extractFields(INVOICE, new FakeClassifier(SCORES));
  assert.equal(fields.invoice_number.value, '2024-000431');
  assert.equal(fields.date.value, '3 avril 2024');
  assert.equal(fields.total.value, 92.4);
  assert.deepEqual(Object.values(fields).map((f) => f.review), [false, false, false]);
});

test('envoie toute la page en une passe, lignes dans l’ordre', async () => {
  const model = new FakeClassifier(SCORES);
  await extractFields(INVOICE, model);
  assert.deepEqual(model.calls, [LINES]);
});

test('un score douteux part en relecture avec sa valeur', async () => {
  const fields = await extractFields(INVOICE, new FakeClassifier(SCORES), { threshold: 0.99 });
  assert.deepEqual(fields.total, { value: 92.4, score: 0.93, review: true });
});

test('le seuil par défaut est 0,75, et un score égal au seuil ne part pas en relecture', async () => {
  assert.equal(DEFAULT_THRESHOLD, 0.75);
  const at = await extractFields(INVOICE, new FakeClassifier({ [LINES[6]]: { total: 0.75 } }));
  const below = await extractFields(INVOICE, new FakeClassifier({ [LINES[6]]: { total: 0.7499 } }));
  assert.equal(at.total.review, false);
  assert.equal(below.total.review, true);
});

test('une ligne désignée sans valeur n’est pas une réponse', async () => {
  const { total } = await extractFields(INVOICE, new FakeClassifier({ [LINES[0]]: { total: 0.99 } }));
  assert.deepEqual(total, { value: null, score: 0.99, review: true });
});

test('un score qui n’est pas un nombre entre zéro et un n’est pas un score', async () => {
  for (const bad of ['very', true, null, 1.5, -0.1, Number.NaN]) {
    const { total } = await extractFields(INVOICE, new FakeClassifier({ [LINES[6]]: { total: bad } }));
    assert.deepEqual(total, { value: null, score: 0, review: true }, String(bad));
  }
});

test('refuse un document trop long avant que le modèle tourne', async () => {
  const model = new FakeClassifier(SCORES);
  await assert.rejects(() => extractFields('ligne\n'.repeat(MAX_LINES + 1), model), RangeError);
  assert.deepEqual(model.calls, []);
  await extractFields('ligne\n'.repeat(MAX_LINES), model);
  assert.equal(model.calls.length, 1);
});

test('une passe tombée est retentée', async () => {
  const model = new FlakyModel(new FakeClassifier(SCORES));
  assert.equal((await extractFields(INVOICE, model)).total.value, 92.4);
  assert.equal(model.passes, 2);
});

test('abandonne après le dernier essai, pas une passe de plus', async () => {
  const model = new FlakyModel(new FakeClassifier(SCORES), 5);
  await assert.rejects(() => extractFields(INVOICE, model), ExtractionUnavailable);
  assert.equal(model.passes, 2);
});

test('une réponse trop courte ou trop longue lève plutôt que décaler les lignes', async () => {
  for (const extra of [-6, 1]) {
    const model = { predict: async (lines) => Array(lines.length + extra).fill({ total: 0.99 }) };
    await assert.rejects(() => extractFields(INVOICE, model), ExtractionUnavailable);
  }
});

test('les boîtes sont sur la grille des millièmes de page', () => {
  const boxes = boxesFor(['tout à gauche', `${' '.repeat(200)}très indentée`, '    bas de page']);
  assert.equal(boxes.length, 3);
  for (const [x0, y0, x1, y1] of boxes) {
    assert.ok(x0 >= 0 && x0 <= x1 && x1 <= 1000 && y0 >= 0 && y0 < y1 && y1 <= 1000);
  }
  assert.deepEqual(boxes.map((b) => b[0]), [0, 960, 48]);
  assert.deepEqual(boxes.map((b) => b[1]), [0, 333, 666]);
});

test('DÉFAUT : le modèle par défaut n’a pas la forme du vrai pipeline de classification de jetons', async () => {
  // LayoutModel appelle le pipeline avec { words, boxes } et lit entity_group
  // ligne par ligne ; le pipeline prend du texte et rend un objet par jeton.
  await assert.rejects(async () => {
    const { total } = await extractFields(INVOICE, new LayoutModel(realShapedTokenPipeline));
    assert.notEqual(total.value, null);
  });
});

test('le point de contrôle nommé est la base non affinée', () => {
  assert.equal(MODEL_NAME, 'Xenova/layoutlmv3-base');
});

test('verdict : un score par champ, donc une file de relecture', async () => {
  const fields = await extractFields(INVOICE, new FakeClassifier(SCORES), { threshold: 0.94 });
  assert.deepEqual(Object.fromEntries(Object.entries(fields).map(([n, f]) => [n, f.review])), {
    invoice_number: false,
    date: false,
    total: true,
  });
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide, aucune passe, et tout en relecture', async () => {
  const model = new FakeClassifier(SCORES);
  const fields = await extractFields('\n  \n', model);
  assert.deepEqual(model.calls, []);
  for (const f of Object.values(fields)) assert.deepEqual(f, { value: null, score: 0, review: true });
});

test('production : cent vingt lignes longues dans une borne large', async () => {
  const lines = Array.from({ length: MAX_LINES }, (_, i) => `Ligne ${i} ${'x'.repeat(5000)} 1 234,56`);
  const debut = performance.now();
  const { total } = await extractFields(lines.join('\n'), new FakeClassifier({ [lines.at(-1)]: { total: 0.9 } }));
  assert.equal(total.value, 1234.56);
  assert.ok(performance.now() - debut < 10_000);
});

test('production : espaces insécables dans le montant et la date', async () => {
  const lines = ['Facture n° FA-1', 'Émise le 3\u00a0avril\u00a02024', 'NET A PAYER 1\u202f092,40\u00a0EUR'];
  const fields = await extractFields(lines.join('\n'), new FakeClassifier({ [lines[1]]: { date: 0.9 }, [lines[2]]: { total: 0.9 } }));
  assert.equal(fields.date.value, '3\u00a0avril\u00a02024');
  assert.equal(fields.total.value, 1092.4);
});

test('production : des lignes nulles dans la réponse ne font pas lever', async () => {
  const model = { predict: async (lines) => [...Array(lines.length - 1).fill(null), { total: 0.9 }] };
  assert.equal((await extractFields(INVOICE, model)).total.value, 92.4);
});

// L'essai de cette fiche a été retiré quand elle est passée en brouillon :
// content/tryouts/frozen/extract-fields-from-invoice.js n'existe plus, et les
// sept tests qui l'exerçaient sont partis avec lui.
