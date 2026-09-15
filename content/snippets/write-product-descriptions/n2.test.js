/**
 * Ces tests injectent un double local au lieu de charger le point de contrôle.
 *
 * Ce qu'ils prouvent : le dossier arrive au modèle sous la forme de l'affinage,
 * un dossier trop grand est refusé avant toute génération, un appel qui échoue
 * est retenté, une phrase inachevée n'est pas publiée, et une copie qui affirme
 * un attribut absent du dossier est refusée.
 *
 * Ce qu'ils ne prouvent pas : que le modèle écrit bien, ni qu'il invente.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import * as n3 from './n3.js';
import { LocalCopywriter, MAX_CHARACTERS, MIN_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe } from './n2.js';

const PRODUCT = {
  name: 'Aurore 500',
  category: 'sac à dos',
  material: 'toile recyclée',
  audience: 'les randonneurs',
  features: ['poche pour ordinateur', 'sangle ventrale'],
  colours: ['ardoise', 'sable'],
  warranty: 'deux ans',
};

const VOCABULARY = ['toile recyclée', 'cuir pleine fleur', 'étanche', 'poche pour ordinateur', 'sangle ventrale', 'garanti à vie'];

const COPY =
  'Aurore 500 accompagne les randonneurs à la journée. Sa toile recyclée ' +
  'encaisse les ronces, et sa sangle ventrale reporte la charge sur les hanches.';

const INVENTED =
  'Aurore 500 suit les randonneurs par tous les temps. Sa toile recyclée ' +
  'est entièrement étanche, et sa sangle ventrale reporte la charge.';

/** Un double qui garde aussi les options de génération. */
function recordingModel(answer) {
  const calls = [];
  return { calls, generate: async (source, options) => { calls.push([source, options]); return answer; } };
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le modèle affirme ce que le dossier ne dit pas', async () => {
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, INVENTED), { vocabulary: VOCABULARY }), (error) => {
    assert.ok(error instanceof UngroundedDescription);
    assert.equal(error.message, 'étanche');
    return true;
  });
  const waterproof = { ...PRODUCT, features: [...PRODUCT.features, 'étanche'] };
  assert.equal(await describe(waterproof, new FakeSeq2Seq({}, INVENTED), { vocabulary: VOCABULARY }), INVENTED);
});

test('point de rupture : un vocabulaire vide laisse passer la même phrase', async () => {
  assert.equal(await describe(PRODUCT, new FakeSeq2Seq({}, INVENTED)), INVENTED);
  assert.equal(await describe(PRODUCT, new FakeSeq2Seq({}, INVENTED), { vocabulary: ['cuir pleine fleur'] }), INVENTED);
});

test('DÉFAUT : un dossier qui nie l’attribut l’ancre quand même', async () => {
  const record = { ...PRODUCT, features: [...PRODUCT.features, 'non étanche'] };
  await assert.rejects(async () => {
    await assert.rejects(() => describe(record, new FakeSeq2Seq({}, INVENTED), { vocabulary: VOCABULARY }), UngroundedDescription);
  }, assert.AssertionError);
});

test('DÉFAUT : un terme de la liste accordé passe le contrôle', async () => {
  await assert.rejects(async () => {
    for (const copy of [
      'Aurore 500 est une lampe solide, garantie à vie par la maison qui la fabrique.',
      'Des coutures étanches et une toile recyclée pour la randonnée du dimanche.',
    ]) {
      await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, copy), { vocabulary: VOCABULARY }), UngroundedDescription);
    }
  }, assert.AssertionError);
});

// ---------------------------------------------------------------------------
// Docstring et commentaires
// ---------------------------------------------------------------------------

test('écrit la copie que le modèle a rendue', async () => {
  assert.equal(await describe(PRODUCT, new FakeSeq2Seq({}, COPY), { vocabulary: VOCABULARY }), COPY);
});

test('envoie le dossier sous la forme de l’affinage', async () => {
  const model = recordingModel(COPY);
  await describe(PRODUCT, model);
  assert.deepEqual(model.calls[0], [
    'name: Aurore 500 | category: sac à dos | material: toile recyclée | audience: les randonneurs | ' +
      'features: poche pour ordinateur, sangle ventrale | colours: ardoise, sable | warranty: deux ans',
    { max_new_tokens: 90, num_beams: 4 },
  ]);
});

test('ne garde que les phrases que le modèle a finies', async () => {
  const model = new FakeSeq2Seq({}, 'Aurore 500 accompagne les randonneurs à la journée. Sa toile recy');
  assert.equal(await describe(PRODUCT, model), 'Aurore 500 accompagne les randonneurs à la journée.');
});

test('DÉFAUT : un point décimal est pris pour une fin de phrase', async () => {
  const model = new FakeSeq2Seq({}, 'Aurore 500 accompagne les randonneurs à la journée et pèse 1.2 kg avec sa toile recy');
  const published = await describe(PRODUCT, model);
  assert.throws(() => assert.ok(!published.endsWith('1.')), assert.AssertionError);
});

test('un fragment est refusé plutôt que publié', async () => {
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, 'Aurore 500.')), DescriptionUnavailable);
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, 'un sac à dos solide et bien pensé pour la journée')), DescriptionUnavailable);
  const exactly = `${'A'.repeat(MIN_CHARACTERS - 1)}.`;
  assert.equal(await describe(PRODUCT, new FakeSeq2Seq({}, exactly)), exactly);
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, `${'A'.repeat(MIN_CHARACTERS - 2)}.`)), DescriptionUnavailable);
});

test('refuse un dossier trop grand avant de générer quoi que ce soit', async () => {
  const model = new FakeSeq2Seq({}, COPY);
  await assert.rejects(() => describe({ name: 'Aurore 500', features: ['détail interminable '.repeat(40)] }, model), RangeError);
  assert.deepEqual(model.calls, []);
  assert.equal(await describe({ n: 'x'.repeat(MAX_CHARACTERS - 3) }, model), COPY);
  await assert.rejects(() => describe({ n: 'x'.repeat(MAX_CHARACTERS - 2) }, model), RangeError);
});

test('retente un appel qui a échoué', async () => {
  let calls = 0;
  const failingOnce = { async generate() { calls += 1; if (calls === 1) throw new Error('checkpoint not loaded'); return COPY; } };
  assert.equal(await describe(PRODUCT, failingOnce, { attempts: 2 }), COPY);
  assert.equal(calls, 2);
  let always = 0;
  const alwaysFailing = { async generate() { always += 1; throw new Error('checkpoint not loaded'); } };
  await assert.rejects(() => describe(PRODUCT, alwaysFailing), (error) => {
    assert.ok(error instanceof DescriptionUnavailable);
    assert.match(error.message, /checkpoint not loaded/);
    return true;
  });
  assert.equal(always, 2);
});

test('la recherche ignore casse et accents, en mot entier', async () => {
  const shouting = 'Aurore 500 SUIT LES RANDONNEURS. SA TOILE EST ENTIÈREMENT ETANCHE, DIT LA NOTICE.';
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, shouting), { vocabulary: VOCABULARY }), UngroundedDescription);
  const record = { ...PRODUCT, features: ['Étanche'.normalize('NFD')] };
  assert.equal(await describe(record, new FakeSeq2Seq({}, shouting), { vocabulary: VOCABULARY }), shouting);
  assert.ok(await describe(PRODUCT, new FakeSeq2Seq({}, 'Aurore 500 offre une étanchéité soignée aux randonneurs du dimanche.'), { vocabulary: VOCABULARY }));
});

test('le modèle est injecté, et par défaut c’est le vrai', async () => {
  await assert.rejects(() => describe(PRODUCT), (error) => {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
    assert.match(error.message, /@huggingface\/transformers/);
    return true;
  });
  // La forme du pipeline : `[{ generated_text }]`, lue par LocalCopywriter.
  const seen = [];
  const writer = new LocalCopywriter(async (source, options) => { seen.push(options); return [{ generated_text: COPY }]; });
  assert.equal(await describe(PRODUCT, writer), COPY);
  assert.deepEqual(seen, [{ max_new_tokens: 90, num_beams: 4 }]);
});

test('le même contrôle qu’au niveau N3', async () => {
  const verdict = async (call) => {
    try {
      await call();
      return 'published';
    } catch (error) {
      return `${error.constructor.name}: ${error.message}`;
    }
  };
  for (const copy of [COPY, INVENTED]) {
    const a = await verdict(() => describe(PRODUCT, new FakeSeq2Seq({}, copy), { vocabulary: VOCABULARY }));
    const b = await verdict(() => n3.describe(PRODUCT, new FakeLLM({ response: JSON.stringify({ description: copy }) }), { vocabulary: VOCABULARY }));
    assert.equal(a, b);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : dossier vide, zéro essai et attribut nul', async () => {
  let model = recordingModel(COPY);
  assert.equal(await describe({}, model), COPY);
  assert.equal(model.calls[0][0], '');
  await assert.rejects(() => describe(PRODUCT, recordingModel(COPY), { attempts: 0 }), DescriptionUnavailable);
  model = recordingModel(COPY);
  await describe({ name: null }, model);
  assert.equal(model.calls[0][0], 'name: null');
});

test('production : une longue réponse et des espaces en désordre', async () => {
  const longCopy = 'Aurore 500 accompagne les randonneurs.\n\n  '.repeat(2000).trim();
  const start = performance.now();
  const published = await describe(PRODUCT, new FakeSeq2Seq({}, longCopy), { vocabulary: VOCABULARY });
  assert.ok(performance.now() - start < 2000);
  assert.ok(!published.includes('\n') && !published.includes('  '));
});

test('production : une réponse d’un autre type n’est pas publiée', async () => {
  // Python la publie telle quelle (DÉFAUT, n2.test.py) ; ici String() rend « [object Object] », refusé comme fragment.
  await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, [{ generated_text: 'Aurore 500 accompagne les randonneurs à la journée.' }])), DescriptionUnavailable);
});

test('DÉFAUT : un terme commençant par une ligature n’est jamais trouvé', async () => {
  // `\b` sans drapeau `u` : « œ » n'est pas un caractère de mot, aucune frontière avant lui.
  const copy = 'Sac aux œillets métalliques, pensé pour les randonneurs de la journée.';
  await assert.rejects(async () => {
    await assert.rejects(() => describe(PRODUCT, new FakeSeq2Seq({}, copy), { vocabulary: ['œillets métalliques'] }), UngroundedDescription);
  }, assert.AssertionError);
});

test('DÉFAUT : le plafond compte des unités UTF-16', async () => {
  // 298 emojis : 304 caractères de source en Python, acceptés ; 602 unités UTF-16 ici.
  await assert.rejects(async () => {
    let out;
    try {
      out = await describe({ name: '🙂'.repeat(298) }, new FakeSeq2Seq({}, COPY));
    } catch (error) {
      assert.fail(`${error.name}: ${error.message}`);
    }
    assert.equal(out, COPY);
  }, assert.AssertionError);
});
