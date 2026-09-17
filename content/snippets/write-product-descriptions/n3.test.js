/**
 * Ces tests injectent un double local au lieu d'appeler un fournisseur.
 *
 * Ce qu'ils prouvent : le dossier arrive dans l'invite, la température demandée
 * est celle envoyée, un dossier trop grand est refusé avant toute dépense, une
 * panne est retentée, une réponse inutilisable lève, et une copie qui affirme
 * un attribut absent du dossier est refusée.
 *
 * Ce qu'ils ne prouvent pas : que le modèle écrit bien, ni qu'il écrit
 * autrement demain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { FakeSDK } from '../_harness/fake-sdk.mjs';
import essai from '../../tryouts/frozen/write-product-descriptions.js';
import {
  MAX_CHARACTERS,
  MIN_CHARACTERS,
  MODEL,
  DescriptionUnavailable,
  UngroundedDescription,
  describe,
  providerClient,
} from './n3.js';

const PRODUCT = {
  name: 'Aurore 500',
  category: 'sac à dos',
  material: 'toile recyclée',
  audience: 'les randonneurs',
  features: ['poche pour ordinateur', 'sangle ventrale'],
  colours: ['ardoise', 'sable'],
  warranty: 'deux ans',
};

const VOCABULARY = ['toile recyclée', 'cuir pleine fleur', 'étanche', 'poche pour ordinateur', 'garanti à vie'];

const COPY =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et sa poche pour ordinateur rentre au bureau le lundi.';

const FOR_LIFE =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et le sac est garanti à vie contre les défauts de couture.';

const answer = (description) => JSON.stringify({ description });

/** Les lignes d'attributs que l'extrait envoie pour une fiche de l'essai (valeurs sans virgule interne). */
const attributeText = (fiche) =>
  fiche
    .split('\n')
    .map((line) => {
      const [key, ...rest] = line.split(' : ');
      return `- ${key.trim()} : ${rest.join(' : ').trim()}`;
    })
    .join('\n');

const PROMPT = [
  "Tu rédiges la présentation d'un article pour une boutique en ligne.",
  "Écris deux phrases en français, sans superlatif, et n'affirme rien qui ne",
  'figure pas dans les caractéristiques ci-dessous.',
  'Réponds par un objet JSON et rien d\'autre : {"description": "…"}.',
  '',
  'Caractéristiques :',
].join('\n');

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le modèle promet ce que la boutique ne vend pas', async () => {
  await assert.rejects(() => describe(PRODUCT, new FakeLLM({ response: answer(FOR_LIFE) }), { vocabulary: VOCABULARY }), (error) => {
    assert.ok(error instanceof UngroundedDescription);
    assert.equal(error.message, 'garanti à vie');
    return true;
  });
  const forLife = { ...PRODUCT, warranty: 'garanti à vie' };
  assert.equal(await describe(forLife, new FakeLLM({ response: answer(FOR_LIFE) }), { vocabulary: VOCABULARY }), FOR_LIFE);
});

test('point de rupture : et il ne vaut que ce que vaut votre liste', async () => {
  assert.equal(await describe(PRODUCT, new FakeLLM({ response: answer(FOR_LIFE) }), { vocabulary: ['étanche'] }), FOR_LIFE);
});

test('point de rupture : l’extrait demande une température non nulle', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  await describe(PRODUCT, client);
  assert.equal(client.lastRequest.temperature, 0.7);
  await describe(PRODUCT, client, { temperature: 0.4 });
  assert.equal(client.lastRequest.temperature, 0.4);
});

test('point de rupture : deux réponses différentes passent toutes deux le contrôle', async () => {
  // Ne démontre rien sur la variation du modèle : les deux copies sont écrites par le double.
  const first = await describe(PRODUCT, new FakeLLM({ response: answer(COPY) }), { vocabulary: VOCABULARY });
  const secondCopy =
    'Aurore 500 part en week-end sans y penser. Sa toile recyclée passe la pluie ' +
    'et les ronces, et son ardoise discrète se fait oublier en réunion.';
  const second = await describe(PRODUCT, new FakeLLM({ response: answer(secondCopy) }), { vocabulary: VOCABULARY });
  assert.notEqual(first, second);
});

test('point de rupture : l’essai montre la promesse dite autrement qui passe', async () => {
  const cas = essai.cases[5];
  assert.equal(cas.fails, true);
  const out = await essai.run(cas.input, 'fr', cas);
  assert.equal(out.verdict, undefined);
  assert.ok(out.output.includes('votre dos reste sec sous l’averse'));
  // Témoin : la promesse écrite avec le terme de la liste est refusée (cas 5).
  const refused = await essai.run(essai.cases[4].input, 'fr', essai.cases[4]);
  assert.equal(refused.verdict.label, 'Publication refusée : une promesse absente du dossier');
});

test('un dossier qui nie l’attribut l’ancre quand même', async () => {
  const record = { ...PRODUCT, features: [...PRODUCT.features, 'non étanche'] };
  const copy = 'Aurore 500 suit les randonneurs par tous les temps, sa toile recyclée est étanche.';
  await assert.rejects(() => describe(record, new FakeLLM({ response: answer(copy) }), { vocabulary: VOCABULARY }), UngroundedDescription);
});

test('un terme de la liste accordé passe le contrôle', async () => {
  const lamp = { ...PRODUCT, category: 'lampe de bureau', gender: 'f' };
  const copy = 'Aurore 500 est une lampe de bureau solide, garantie à vie contre les défauts.';
  await assert.rejects(() => describe(lamp, new FakeLLM({ response: answer(copy) }), { vocabulary: VOCABULARY }), UngroundedDescription);
});

// ---------------------------------------------------------------------------
// Docstring et commentaires
// ---------------------------------------------------------------------------

test('écrit la copie que le modèle a rendue', async () => {
  assert.equal(await describe(PRODUCT, new FakeLLM({ response: answer(COPY) }), { vocabulary: VOCABULARY }), COPY);
});

test('envoie des consignes en français et le dossier entier', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  await describe(PRODUCT, client);
  assert.equal(
    client.lastRequest.prompt,
    `${PROMPT}\n${[
      '- name : Aurore 500',
      '- category : sac à dos',
      '- material : toile recyclée',
      '- audience : les randonneurs',
      '- features : poche pour ordinateur, sangle ventrale',
      '- colours : ardoise, sable',
      '- warranty : deux ans',
    ].join('\n')}`,
  );
});

test('replie les retours à la ligne que le modèle laisse', async () => {
  assert.equal(await describe(PRODUCT, new FakeLLM({ response: answer(`  ${COPY}\n\n  `) })), COPY);
});

test('refuse un dossier trop grand avant de dépenser quoi que ce soit', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  await assert.rejects(() => describe({ name: 'Aurore 500', features: ['détail interminable '.repeat(40)] }, client), RangeError);
  assert.equal(client.callCount, 0);
  assert.equal(await describe({ n: 'x'.repeat(MAX_CHARACTERS - 6) }, client), COPY);
  await assert.rejects(() => describe({ n: 'x'.repeat(MAX_CHARACTERS - 5) }, client), RangeError);
  assert.equal(client.callCount, 1);
});

test('une panne est retentée le nombre de fois annoncé', async () => {
  let client = new FakeLLM({ response: answer(COPY), failTimes: 2 });
  assert.equal(await describe(PRODUCT, client, { attempts: 3 }), COPY);
  assert.equal(client.callCount, 3);
  client = new FakeLLM({ response: answer(COPY), failTimes: 5 });
  await assert.rejects(() => describe(PRODUCT, client), (error) => {
    assert.ok(error instanceof DescriptionUnavailable);
    assert.match(error.message, /simulated provider failure/);
    return true;
  });
  assert.equal(client.callCount, 3);
});

test('une réponse qui n’est pas du JSON lève plutôt que d’être publiée', async () => {
  const client = new FakeLLM({ response: 'Bien sûr ! Voici une proposition de description :' });
  await assert.rejects(() => describe(PRODUCT, client, { attempts: 2 }), DescriptionUnavailable);
  assert.equal(client.callCount, 2);
});

test('une réponse d’une autre forme lève', async () => {
  // JSON sans description, description vide, nombre, `null`, clôture non
  // refermée, prose autour d'une clôture.
  const responses = [
    JSON.stringify({ titre: 'Aurore 500' }),
    answer(''),
    answer(42),
    'null',
    `\`\`\`json\n${answer(COPY)}`,
    `Voici la description :\n\`\`\`json\n${answer(COPY)}\n\`\`\``,
  ];
  for (const response of responses) {
    await assert.rejects(() => describe(PRODUCT, new FakeLLM({ response }), { attempts: 1 }), DescriptionUnavailable);
  }
});

test('une description en liste est publiée, collée par une virgule', async () => {
  // Python lève DescriptionUnavailable sur la même réponse.
  const response = answer(['Aurore 500 tient la journée de marche.', 'Sa toile recyclée encaisse les ronces.']);
  await assert.rejects(() => describe(PRODUCT, new FakeLLM({ response }), { attempts: 1 }), DescriptionUnavailable);
});

test('un fragment est refusé', async () => {
  await assert.rejects(() => describe(PRODUCT, new FakeLLM({ response: answer('Un sac à dos.') })), DescriptionUnavailable);
  assert.equal(await describe(PRODUCT, new FakeLLM({ response: answer('A'.repeat(MIN_CHARACTERS)) })), 'A'.repeat(MIN_CHARACTERS));
  await assert.rejects(() => describe(PRODUCT, new FakeLLM({ response: answer('A'.repeat(MIN_CHARACTERS - 1)) })), DescriptionUnavailable);
});

test('la recherche ignore casse et accents', async () => {
  await assert.rejects(
    () => describe(PRODUCT, new FakeLLM({ response: answer(FOR_LIFE.replace('garanti à vie', 'GARANTI A VIE')) }), { vocabulary: VOCABULARY }),
    UngroundedDescription,
  );
  const record = { ...PRODUCT, warranty: 'Garanti À VIE'.normalize('NFD') };
  assert.equal(await describe(record, new FakeLLM({ response: answer(FOR_LIFE) }), { vocabulary: VOCABULARY }), FOR_LIFE);
});

test('le client est injecté pour tester sans réseau', async () => {
  await assert.rejects(() => describe(PRODUCT), (error) => {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
    assert.match(error.message, /openai/);
    return true;
  });
});

test('production : l’adaptateur appelle la surface du vrai kit', async () => {
  // L'adaptateur sur le double du harnais, à la forme du kit `openai` publié,
  // sans méthode `complete` : `chat.completions.create({ model, messages,
  // temperature })`, réponse lue dans `choices[0].message.content`.
  const sdk = new FakeSDK({ content: answer(COPY) });
  assert.equal(sdk.complete, undefined);
  const client = await providerClient(sdk);
  assert.equal(await describe(PRODUCT, client, { temperature: 0.4 }), COPY);
  const { endpoint, model, messages, temperature } = sdk.lastRequest;
  assert.deepEqual([endpoint, model], ['chat.completions', MODEL]);
  assert.equal(messages[0].role, 'user');
  assert.ok(messages[0].content.includes(PRODUCT.name));
  // La température demandée est celle qui arrive au kit, pas une valeur par défaut.
  assert.equal(temperature, 0.4);
  assert.equal(sdk.requests.length, 1);
  const tiede = new FakeSDK({ content: answer(COPY) });
  await describe(PRODUCT, await providerClient(tiede));
  assert.equal(tiede.lastRequest.temperature, 0.7);
});

test('production : l’adaptateur, une réponse sans contenu lève après les essais', async () => {
  // Le kit type `content` comme facultatif : `null` n'est pas une copie.
  const sdk = new FakeSDK({ content: null });
  const client = await providerClient(sdk);
  await assert.rejects(() => describe(PRODUCT, client), DescriptionUnavailable);
  assert.equal(sdk.requests.length, 3);
});

test('production : l’adaptateur, une panne du kit est retentée', async () => {
  const sdk = new FakeSDK({ content: answer(COPY), failTimes: 2 });
  assert.equal(await describe(PRODUCT, await providerClient(sdk)), COPY);
  assert.equal(sdk.requests.length, 3);
  const mort = new FakeSDK({ content: answer(COPY), failTimes: 3 });
  const client = await providerClient(mort);
  await assert.rejects(() => describe(PRODUCT, client), DescriptionUnavailable);
  assert.equal(mort.requests.length, 3);
});

test('l’essai rend ses cinq premiers cas comme il les annonce', async () => {
  const run = (i, lang = 'fr') => essai.run(essai.cases[i].input, lang, essai.cases[i]);
  const first = await run(0);
  assert.equal(first.output, COPY);
  assert.equal(first.note, `1 appel facturé, ${PROMPT.length + 1 + attributeText(essai.cases[0].input).length} caractères partis chez le fournisseur, consignes et fiche comprises.`);
  assert.equal(first.note, '1 appel facturé, 490 caractères partis chez le fournisseur, consignes et fiche comprises.');
  const second = await run(1);
  assert.equal(second.verdict.label, 'Refusé avant le premier appel');
  assert.equal(second.note, 'Rien n’est parti chez le fournisseur, rien n’est dû.');
  assert.equal((await run(2)).note, '3 appels facturés : les deux premiers ont échoué, le troisième a répondu.');
  const prose = await run(3);
  assert.equal(prose.verdict.label, 'Réponse rejetée');
  assert.equal(prose.note, '3 appels envoyés et facturés, aucune réponse publiable.');
  assert.equal((await run(4)).verdict.detail, 'Le contrôle terme à terme a trouvé « garanti à vie » dans le texte et nulle part dans le dossier.');
});

test('l’essai compte bien 702 caractères d’attributs dans la fiche encombrée', async () => {
  // `shown` : « 702 caractères d’attributs, 102 de trop ».
  assert.equal(attributeText(essai.cases[1].input).length, 702);
  assert.equal(702 - MAX_CHARACTERS, 102);
  assert.ok(essai.cases[1].shown.fr.includes('702 caractères d’attributs, 102 de trop'));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un dossier vide ne part pas chez le fournisseur', async () => {
  // Un dossier sans un attribut ne peut rien donner : il est refusé avant de
  // coûter un appel.
  const client = new FakeLLM({ response: answer(COPY) });
  await assert.rejects(() => describe({}, client), { name: 'RangeError', message: /empty product record/ });
  assert.equal(client.callCount, 0);
});

test('production : zéro essai lève sans appel', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  await assert.rejects(() => describe(PRODUCT, client, { attempts: 0 }), DescriptionUnavailable);
  assert.equal(client.callCount, 0);
});

test('le plafond compte des unités UTF-16', async () => {
  // 296 emojis : 305 caractères d'attributs en Python, acceptés ; 601 unités UTF-16 ici.
  let out;
  try {
    out = await describe({ name: '🙂'.repeat(296) }, new FakeLLM({ response: answer(COPY) }));
  } catch (error) {
    assert.fail(`${error.name}: ${error.message}`);
  }
  assert.equal(out, COPY);
});
