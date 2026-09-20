import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeLLM } from '../_harness/fake-llm.mjs';
import { FakeSDK } from '../_harness/fake-sdk.mjs';
import {
  FIELDS, MAX_CHARACTERS, MAX_HTML, MODEL, ReadingUnavailable, providerClient, readProduct, toText,
} from './n3.js';

const PAGE = '<!doctype html><html><head><style>.prix{color:red}</style>'
  + '<script>window.tracking={}</script></head><body>'
  + '<nav>Accueil  Boutique</nav>'
  + '<h1>Moulin à café Lumière</h1><p>Référence MC-4501</p>'
  + '<p class="prix">19,90 €</p><p>En stock</p></body></html>';

const LU = {
  name: 'Moulin à café Lumière', sku: 'MC-4501', brand: 'Lumière',
  price: '19,90', currency: 'EUR', availability: 'En stock',
};

const double = (reponse = LU, extra = {}) => new FakeLLM({
  response: JSON.stringify(reponse), ...extra,
});

const vide = () => Object.fromEntries(FIELDS.map((f) => [f, null]));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : la garde vérifie d'où vient une valeur, pas ce qu'elle veut dire", async () => {
  const rapport = await readProduct(PAGE, { client: double() });
  assert.ok(PAGE.includes('€'));
  assert.ok(!PAGE.includes('EUR'));
  assert.deepEqual(rapport.invented, ['currency']);
  assert.equal(rapport.product.currency, null);
});

test("point de rupture : témoin, un prix absent de la page est bien écarté", async () => {
  const rapport = await readProduct(PAGE, { client: double({ ...LU, price: '24,90' }) });
  assert.ok(!PAGE.includes('24,90'));
  assert.equal(rapport.product.price, null);
  assert.ok(rapport.invented.includes('price'));
  assert.equal((await readProduct(PAGE, { client: double() })).product.price, '19,90');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la page est débarrassée de son balisage avant de partir', () => {
  const texte = toText(PAGE);
  assert.ok(!texte.includes('<'));
  assert.ok(!texte.includes('>'));
  assert.ok(!texte.includes('window.tracking'));
  assert.ok(!texte.includes('color:red'));
  assert.ok(texte.includes('Moulin à café Lumière'));
  assert.ok(texte.includes('19,90 €'));
  assert.ok(texte.length < PAGE.length / 3);
});

test('la page est coupée au budget, pas refusée', async () => {
  const enorme = PAGE.replace('</body>', `<p>${'x'.repeat(500_000)}</p></body>`);
  const rapport = await readProduct(enorme, { client: double() });
  assert.equal(rapport.characters_sent, MAX_CHARACTERS);
  assert.equal(rapport.product.name, 'Moulin à café Lumière');
});

test('la requête porte le texte de la page et les champs demandés', async () => {
  const client = double();
  await readProduct(PAGE, { client });
  const envoye = client.lastRequest.prompt;
  assert.ok(envoye.includes('Moulin à café Lumière'));
  for (const champ of FIELDS) assert.ok(envoye.includes(champ), champ);
  assert.equal(client.lastRequest.temperature, 0);
});

test('une réponse dans une clôture de code est décodée', async () => {
  const client = new FakeLLM({ response: `\`\`\`json\n${JSON.stringify(LU)}\n\`\`\`` });
  assert.equal((await readProduct(PAGE, { client })).product.sku, 'MC-4501');
  for (const mauvaise of [`Voici : ${JSON.stringify(LU)}`,
    '```json\n{}\n```\n```json\n{}\n```', '```json\n{}', '']) {
    await assert.rejects(
      () => readProduct(PAGE, { client: new FakeLLM({ response: mauvaise }), attempts: 1 }),
      ReadingUnavailable,
    );
  }
});

test("un refus du modèle n'est pas passé au décodeur", async () => {
  // Un refus revient sans contenu. Le double du harnais rend `null` sous forme
  // de texte, alors ce cas se pose directement : un client dont `complete`
  // rend null, comme le fait l'adaptateur sur un `content` nul.
  const refus = { complete: async () => null };
  await assert.rejects(
    () => readProduct(PAGE, { client: refus, attempts: 1 }),
    (erreur) => erreur instanceof ReadingUnavailable
      && String(erreur.message).includes('the model answered no text'),
  );
});

test("une panne est retentée le nombre de fois annoncé", async () => {
  const client = double(LU, { failTimes: 2 });
  assert.equal((await readProduct(PAGE, { client, attempts: 3 })).product.sku, 'MC-4501');
  assert.equal(client.callCount, 3);
  const trop = double(LU, { failTimes: 3 });
  await assert.rejects(() => readProduct(PAGE, { client: trop, attempts: 3 }), ReadingUnavailable);
  assert.equal(trop.callCount, 3);
});

test("l'adaptateur par défaut parle au vrai kit", async () => {
  // T2 : l'adaptateur est exécuté contre le double du harnais.
  const sdk = new FakeSDK({ content: JSON.stringify(LU) });
  const client = await providerClient(sdk);
  const rapport = await readProduct(PAGE, { client });
  assert.equal(rapport.product.sku, 'MC-4501');
  const envoye = sdk.lastRequest;
  assert.equal(envoye.endpoint, 'chat.completions');
  assert.equal(envoye.model, MODEL);
  assert.equal(envoye.temperature, 0);
  assert.equal(envoye.messages[0].role, 'user');
  assert.ok(envoye.messages[0].content.includes('Moulin à café Lumière'));
  const refus = await providerClient(new FakeSDK({ content: null }));
  await assert.rejects(() => readProduct(PAGE, { client: refus, attempts: 1 }), ReadingUnavailable);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une fiche sans données structurées', async () => {
  const rapport = await readProduct(PAGE, { client: double() });
  assert.equal(rapport.source, 'model');
  assert.equal(rapport.product.name, 'Moulin à café Lumière');
  assert.equal(rapport.product.sku, 'MC-4501');
});

test('production : entrée vide', async () => {
  const rapport = await readProduct('', { client: double(vide()) });
  assert.equal(rapport.characters_sent, 0);
  assert.ok(Object.values(rapport.product).every((v) => v === null));
  assert.deepEqual(rapport.invented, []);
});

test('production : encodages inattendus', async () => {
  const page = PAGE.replace('Moulin à café Lumière', 'Bouilloire 🫖 Lumière');
  const rapport = await readProduct(page, {
    client: double({ ...LU, name: 'Bouilloire 🫖 Lumière' }),
  });
  assert.equal(rapport.product.name, 'Bouilloire 🫖 Lumière');
  const majuscules = await readProduct(PAGE, {
    client: double({ ...LU, name: 'MOULIN À CAFÉ LUMIÈRE' }),
  });
  assert.equal(majuscules.product.name, 'MOULIN À CAFÉ LUMIÈRE');
  const sansAccent = await readProduct(PAGE, {
    client: double({ ...LU, name: 'Moulin a cafe Lumiere' }),
  });
  assert.ok(sansAccent.invented.includes('name'));
});

test('production : entrée très grande, la page hostile du niveau N0', () => {
  // La page que le niveau N0 de cette fiche est écrit pour survivre : vingt
  // mille balises `<script>` jamais refermées. Le nettoyage de ce niveau la
  // traversait avec le même effondrement d'expression régulière que le N0
  // évite, **avant** l'appel au modèle. La charte des tests demande qu'une
  // entrée trop grande soit refusée avant l'appel : le plafond de balisage est
  // donc appliqué en premier, et les blocs sont balayés.
  const hostile = '<script type="application/ld+json">'.repeat(20_000);
  let debut = performance.now();
  assert.equal(toText(hostile), '');
  assert.ok(performance.now() - debut < 1_000);
  // Les mêmes balises, en `<style>` : c'est la seconde branche du motif.
  debut = performance.now();
  assert.equal(toText('<style>'.repeat(20_000)), '');
  assert.ok(performance.now() - debut < 1_000);
  // Témoin : une page ordinaire, cent fois le cas nominal, reste lisible.
  const grande = PAGE + '<p>Livraison offerte.</p>'.repeat(10_000);
  debut = performance.now();
  const texte = toText(grande);
  assert.ok(performance.now() - debut < 1_000);
  assert.ok(texte.includes('Moulin à café Lumière'));
});

test("production : le plafond de balisage s'applique avant le nettoyage", () => {
  // Commentaire : « a cap applied after the cleaning protects nothing, since
  // the cleaning is the part that costs ».
  const loin = '<p>a</p>'.repeat(Math.floor(MAX_HTML / 8) + 10) + '<p>Moulin à café Lumière</p>';
  assert.ok(loin.length > MAX_HTML);
  assert.ok(!toText(loin).includes('Moulin'));
  const proche = '<p>a</p>'.repeat(10) + '<p>Moulin à café Lumière</p>';
  assert.ok(proche.length < MAX_HTML);
  assert.ok(toText(proche).includes('Moulin à café Lumière'));
});

test('production : valeurs aux limites', async () => {
  const texte = 'a'.repeat(MAX_CHARACTERS);
  assert.equal(
    (await readProduct(texte, { client: double(vide()) })).characters_sent, MAX_CHARACTERS,
  );
  assert.equal(
    (await readProduct(`${texte}b`, { client: double(vide()) })).characters_sent, MAX_CHARACTERS,
  );
  assert.deepEqual(
    (await readProduct(PAGE, { client: new FakeLLM({ response: '[]' }) })).product, vide(),
  );
  assert.deepEqual(
    (await readProduct(PAGE, { client: new FakeLLM({ response: '{}' }) })).invented, [],
  );
});

test("production : un champ inventé n'empêche pas de garder les autres", async () => {
  const rapport = await readProduct(PAGE, {
    client: double({ ...LU, sku: 'MC-0000', price: '24,90' }),
  });
  assert.equal(rapport.product.name, 'Moulin à café Lumière');
  assert.deepEqual(rapport.invented, ['sku', 'price', 'currency']);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  // latency « ~1 s » : la classe est celle de l'appel au fournisseur, que le
  // double ne mesure pas. Ce test ne borne que la part locale.
  const client = double();
  const debut = performance.now();
  for (let i = 0; i < 1_000; i += 1) await readProduct(PAGE, { client });
  assert.ok(performance.now() - debut < 60_000);
});
