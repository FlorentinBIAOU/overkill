/**
 * Ces tests injectent un double local au lieu de charger un modèle de
 * traduction.
 *
 * Ce qu'ils prouvent : les variables sont cachées avant que le modèle ne voie
 * la chaîne, remises après, une variable déplacée est acceptée, une variable
 * perdue ou réécrite est signalée plutôt que livrée, un appel qui échoue est
 * retenté, et une réponse vide lève au lieu de rendre un libellé blanc.
 *
 * Ce qu'ils ne prouvent pas : que le modèle traduit bien, ni qu'il rend le
 * marqueur. Le double écrit la réponse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import essai from '../../tryouts/frozen/translate-interface-strings.js';
import { MODEL_NAME, TranslationUnavailable, placeholders, translate } from './n2.js';
import { translate as translateN3 } from './n3.js';

// Les deux caractères du marqueur, absents du vocabulaire de opus-mt-en-fr
// (vocab.json, 59 514 entrées, vérifié) : le modèle les reçoit en <unk>.
// Les deux caractères d'encadrement du marqueur. Le commentaire de `MARK` dit
// que ses pièces sont dans le vocabulaire du modèle nommé, et qu'un marqueur
// fait de caractères qui n'y sont pas serait perdu : voici de quoi le montrer,
// en imitant un vocabulaire qui ignorerait ces deux-là.
const MARKER_BRACKETS = '[]';

/** Un modèle qui meurt à ses premiers appels, comme un vrai processus. */
class FlakySeq2Seq extends FakeSeq2Seq {
  constructor(outputs, failTimes = 1) {
    super(outputs);
    this.failTimes = failTimes;
  }

  async generate(text) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      this.calls.push(text);
      throw new Error('the model worker died');
    }
    return super.generate(text);
  }
}

/** Un traducteur parfait qui rend ce qu'il sait lire ; `drop` imite le vocabulaire du vrai modèle. */
function echoTranslator(replacements = [], drop = '') {
  const calls = [];
  return {
    calls,
    async generate(text) {
      calls.push(text);
      let out = text;
      for (const [from, to] of replacements) out = out.split(from).join(to);
      return [...out].filter((c) => !drop.includes(c)).join('');
    },
  };
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le modèle reçoit un marqueur, jamais la variable', async () => {
  const model = new FakeSeq2Seq({ '[0] items selected': '[0] éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.deepEqual(model.calls, ['[0] items selected']);
  assert.ok(!model.calls[0].includes('count'));
  assert.deepEqual(result, { target: '{count} éléments sélectionnés', review: false, warnings: [] });
});

test('point de rupture : une variable perdue est attrapée, pas livrée', async () => {
  const model = new FakeSeq2Seq({ '[0] items selected': 'Des éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.equal(result.target, 'Des éléments sélectionnés');
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['variables differ from the source: expected {count}, got none']);
});

test('point de rupture : une accolade inventée est attrapée aussi', async () => {
  const model = new FakeSeq2Seq({ '[0] items selected': '{compte} éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['variables differ from the source: expected {count}, got {compte}']);
});

test('un marqueur hors du vocabulaire du modèle est perdu, et signalé', async () => {
  // Commentaire de `MARK` : « a marker made of characters the vocabulary lacks
  // is dropped ». Témoin : les pièces du marqueur retenu sont dans le
  // vocabulaire du modèle nommé, il les réécrit, et rien n'est signalé.
  const perfect = [['items selected', 'éléments sélectionnés']];
  assert.equal((await translate('{count} items selected', { model: echoTranslator(perfect) })).review, false);
  // Un modèle dont le vocabulaire ignorerait ces caractères les laisserait
  // tomber, et la variable perdue serait attrapée plutôt que livrée.
  const sansCrochets = echoTranslator(perfect, MARKER_BRACKETS);
  const result = await translate('{count} items selected', { model: sansCrochets });
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['variables differ from the source: expected {count}, got none']);
});

test('point de rupture : l’essai montre la variable perdue en relecture', async () => {
  const cas = essai.cases[5];
  assert.equal(cas.fails, true);
  const fr = await essai.run(cas.input, 'fr', cas);
  assert.equal(fr.verdict.label, 'Renvoyée en relecture');
  assert.equal(fr.output, 'Des éléments sélectionnés');
  assert.equal(fr.note, 'Le modèle a reçu « [0] items selected » — 1 appel.');
});

test('INFIRMÉ : le `why` de l’essai parle d’une « variable traduite, « {compte} » » ; le modèle ne reçoit jamais « count »', async () => {
  const model = new FakeSeq2Seq({}, '{compte} éléments sélectionnés');
  await translate('{count} items selected', { model });
  assert.throws(() => assert.ok(model.calls[0].includes('count')), assert.AssertionError);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires
// ---------------------------------------------------------------------------

test('traduit une chaîne sans variable', async () => {
  const model = new FakeSeq2Seq({ 'Save changes': 'Enregistrer les modifications' });
  assert.deepEqual(await translate('Save changes', { model }), {
    target: 'Enregistrer les modifications', review: false, warnings: [],
  });
});

test('une paire de langues à la fois', () => {
  assert.equal(MODEL_NAME, 'Xenova/opus-mt-en-fr');
  assert.match(translate.toString(), /^async function translate\(source, \{ model, attempts = 2 \} = \{\}\)/);
});

test('une variable déplacée est l’affaire du modèle', async () => {
  const model = new FakeSeq2Seq({ 'Delete [0] of [1]': 'Sur [1], supprimer [0]' });
  assert.deepEqual(await translate('Delete {count} of {total}', { model }), {
    target: 'Sur {total}, supprimer {count}', review: false, warnings: [],
  });
});

test('une variable répétée ou inventée par le modèle est signalée', async () => {
  const model = new FakeSeq2Seq({ '[0] items selected': '[0] éléments [0] sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.equal(result.target, '{count} éléments {count} sélectionnés');
  assert.deepEqual(result.warnings, ['variables differ from the source: expected {count}, got {count} {count}']);
});

test('les variables sont cachées, remises et comptées sous toutes leurs formes', async () => {
  const source = '{} %s %d %(name)s %1$s %2$d {count} {count}';
  const model = echoTranslator();
  const result = await translate(source, { model });
  assert.deepEqual(model.calls, ['[0] [1] [2] [3] [4] [5] [6] [7]']);
  assert.deepEqual(result, { target: source, review: false, warnings: [] });
});

test('onze variables ne confondent pas les marqueurs un et dix', async () => {
  const source = Array.from({ length: 11 }, (_, i) => `{v${i}}`).join(' ');
  const model = echoTranslator();
  assert.equal((await translate(source, { model })).target, source);
  assert.ok(model.calls[0].includes('[10]') && model.calls[0].includes('[1]'));
});

test('un modèle qui échoue est retenté', async () => {
  let model = new FlakySeq2Seq({ Save: 'Enregistrer' }, 1);
  assert.equal((await translate('Save', { model, attempts: 2 })).target, 'Enregistrer');
  assert.equal(model.calls.length, 2);

  model = new FlakySeq2Seq({ Save: 'Enregistrer' }, 5);
  await assert.rejects(() => translate('Save', { model, attempts: 2 }), (error) => {
    assert.ok(error instanceof TranslationUnavailable);
    assert.match(error.message, /the model worker died/);
    return true;
  });
  assert.equal(model.calls.length, 2);
});

test('une réponse vide lève plutôt que de blanchir l’interface', async () => {
  const model = new FakeSeq2Seq({}, '   ');
  await assert.rejects(() => translate('Save', { model, attempts: 2 }), TranslationUnavailable);
  assert.equal(model.calls.length, 2);
});

test('une source vide ne vaut pas un appel', async () => {
  const model = new FakeSeq2Seq({});
  assert.deepEqual(await translate('', { model }), { target: '', review: false, warnings: [] });
  assert.equal((await translate('   ', { model })).target, '   ');
  assert.deepEqual(model.calls, []);
});

test('le modèle est injecté, et par défaut c’est le vrai', async () => {
  await assert.rejects(() => translate('Save'), (error) => {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
    assert.match(error.message, /@huggingface\/transformers/);
    return true;
  });
  // Une source vide ou blanche est rendue telle quelle : rien n'est chargé pour
  // l'apprendre.
  assert.deepEqual(await translate(''), { target: '', review: false, warnings: [] });
  assert.equal((await translate('   ')).target, '   ');
});

test('un modèle à la forme du pipeline de traduction est accepté', async () => {
  const pipe = async (text) => [{ translation_text: text.replace('items selected', 'éléments sélectionnés') }];
  const wrapped = { generate: async (text) => (await pipe(text))[0].translation_text };
  assert.equal((await translate('{count} items selected', { model: wrapped })).target, '{count} éléments sélectionnés');
});

test('la plomberie est déterministe', async () => {
  const model = new FakeSeq2Seq({ 'Delete [0] of [1]': 'Sur [1], supprimer [0]' });
  const first = await translate('Delete {count} of {total}', { model });
  for (let i = 0; i < 5; i += 1) assert.deepEqual(await translate('Delete {count} of {total}', { model }), first);
});

test('verdict : N2 masque la variable que N3 montre dans l’invite', async () => {
  const seq2seq = new FakeSeq2Seq({ '[0] items selected': '[0] éléments sélectionnés' });
  await translate('{count} items selected', { model: seq2seq });
  const llm = new FakeLLM({ response: { translation: '{count} éléments sélectionnés' } });
  await translateN3('{count} items selected', 'French', { client: llm });
  assert.ok(!seq2seq.calls[0].includes('{count}'));
  assert.ok(llm.lastRequest.prompt.includes('{count} items selected'));
});

test('l’essai rend ses six cas comme il les annonce', async () => {
  const expected = [
    ['Traduction acceptée', 'Enregistrer les modifications', 'Le modèle a reçu « Save changes » — 1 appel.'],
    ['Traduction acceptée', '{count} éléments sélectionnés', 'Le modèle a reçu « [0] items selected » — 1 appel.'],
    ['Traduction acceptée', 'Sur {total}, supprimer {count}', 'Le modèle a reçu « Delete [0] of [1] » — 1 appel.'],
    ['Traduction acceptée', 'Enregistrer', 'Le modèle a reçu « Save » — 2 appels.'],
    ['Traduction refusée', undefined, 'Le modèle a reçu « Save » — 2 appels.'],
    ['Renvoyée en relecture', 'Des éléments sélectionnés', 'Le modèle a reçu « [0] items selected » — 1 appel.'],
  ];
  assert.equal(essai.cases.length, 6);
  for (const [i, [label, output, note]] of expected.entries()) {
    const cas = essai.cases[i];
    const out = await essai.run(cas.input, 'fr', cas);
    assert.equal(out.verdict.label, label, `cas ${i + 1}`);
    assert.equal(out.output, output, `cas ${i + 1}`);
    assert.equal(out.note, note, `cas ${i + 1}`);
    const en = await essai.run(cas.input, 'en', cas);
    assert.ok(en.verdict.label.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une chaîne de cent variables termine vite', async () => {
  const source = Array.from({ length: 100 }, (_, i) => `{v${i}}`).join(' and ').repeat(5);
  const start = performance.now();
  assert.equal((await translate(source, { model: echoTranslator() })).target, source);
  assert.ok(performance.now() - start < 2000);
});

test('production : encodage NFD, emoji, insécable', async () => {
  const source = 'Supprimé : {count} 🙂'.normalize('NFD');
  assert.deepEqual(await translate(source, { model: echoTranslator() }), { target: source, review: false, warnings: [] });
});

test('production : zéro essai lève sans appel', async () => {
  const model = new FakeSeq2Seq({ Save: 'Enregistrer' });
  await assert.rejects(() => translate('Save', { model, attempts: 0 }), TranslationUnavailable);
  assert.deepEqual(model.calls, []);
});

test('production : les espaces de bord sont retirés de la traduction', async () => {
  const model = new FakeSeq2Seq({ 'Name: ': 'Nom : ' });
  assert.equal((await translate('Name: ', { model })).target, 'Nom :');
});

test('une réponse d’un autre type ne lève pas l’erreur nommée', async () => {
  // Une liste brute du pipeline : TypeError (`output.trim is not a function`).
  const model = new FakeSeq2Seq({}, [{ translation_text: 'Enregistrer' }]);
  await assert.rejects(() => translate('Save', { model }), TranslationUnavailable);
});

test('les variables ICU et i18next sont protégées', async () => {
  // docstring : « An ICU plural or select message always goes to review ».
  const icu = '{count, plural, one {# item} other {# items}}';
  const translated = echoTranslator([['count, plural, one', 'compte, pluriel, un'], ['other', 'autre']]);
  const result = await translate(icu, { model: translated });
  // La tête de l'argument est masquée, donc jamais traduite. Les branches, elles,
  // partent en clair : c'est pour ça que le message entier est renvoyé en relecture.
  assert.deepEqual(translated.calls, ['[0], one {# item} other {# items}}']);
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['ICU message: check its branches by hand']);
  // La variable d'i18next, elle, est masquée entière : elle revient intacte.
  const i18next = new FakeSeq2Seq({ '[0] items': '[0] éléments' });
  assert.deepEqual(await translate('{{count}} items', { model: i18next }), {
    target: '{{count}} éléments', review: false, warnings: [],
  });
});

test('production : placeholders rend les variables dans l’ordre', () => {
  assert.deepEqual(placeholders('Delete {count} of {total}'), ['{count}', '{total}']);
});
