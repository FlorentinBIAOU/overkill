import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mask, normalise } from './n0.js';
import essai from '../../tryouts/live/mask-personal-data-in-chat.js';

const TEMOIN = 'appelle-moi au 06 12 34 56 78';

/** ISO 13616 : lettres en nombres, quatre premiers caractères à la fin, reste modulo 97 égal à 1. */
function ibanChecksumIsValid(iban) {
  const compact = iban.replaceAll(' ', '').toUpperCase();
  const digits = [...(compact.slice(4) + compact.slice(0, 4))].map((c) => parseInt(c, 36)).join('');
  return BigInt(digits) % 97n === 1n;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : les chiffres en lettres passent au travers', () => {
  assert.equal(mask('zéro six douze'), 'zéro six douze');
  assert.equal(mask('call me on zero six twelve thirty-four'), 'call me on zero six twelve thirty-four');
  // Témoin : le même numéro en chiffres est masqué.
  assert.equal(mask(TEMOIN), 'appelle-moi au [phone]');
});

test('point de rupture : les chiffres sosies passent au travers', () => {
  assert.equal(mask('O6 I2 34'), 'O6 I2 34');
  assert.equal(mask('appelle-moi au O6 I2 34 56 78'), 'appelle-moi au O6 I2 34 56 78');
  assert.equal(mask(TEMOIN), 'appelle-moi au [phone]');
});

test('point de rupture : des emojis intercalés passent au travers', () => {
  assert.equal(mask('appelle-moi au 06🙂12🙂34🙂56🙂78'), 'appelle-moi au 06🙂12🙂34🙂56🙂78');
  assert.equal(mask(TEMOIN), 'appelle-moi au [phone]');
});

test('point de rupture : une référence de commande est masquée comme un IBAN', () => {
  const reference = 'DE 12 3456 7890 1234';
  assert.ok(!ibanChecksumIsValid(reference)); // ce n'est pas un IBAN
  assert.equal(mask(`commande ${reference} expédiée`), 'commande [iban] expédiée');

  // Témoin : sans lettres de pays, rien ; un IBAN valide est masqué pareil.
  assert.equal(mask('commande 12 3456 7890 1234 expédiée'), 'commande 12 3456 7890 1234 expédiée');
  assert.ok(ibanChecksumIsValid('FR76 3000 6000 0112 3456 7890 189'));
  assert.equal(mask('compte FR76 3000 6000 0112 3456 7890 189'), 'compte [iban]');
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('masque une adresse électronique', () => {
  assert.equal(mask('write to me at jean.dupont@example.com'), 'write to me at [email]');
});

test('masque un numéro avec espace, point, tiret ou sans séparateur', () => {
  for (const written of ['0612345678', '06 12 34 56 78', '06.12.34.56.78', '06-12-34-56-78', '+33 6 12 34 56 78', '+33612345678']) {
    assert.equal(mask(`call me on ${written}`), 'call me on [phone]', written);
  }
});

test('INFIRMÉ : chaque motif tolère les séparateurs réellement tapés ; « 06/12/34/56/78 » et une double espace passent en clair', async () => {
  await assert.rejects(async () => {
    for (const written of ['06/12/34/56/78', '06 12  34 56 78']) {
      assert.equal(mask(`call me on ${written}`), 'call me on [phone]', written);
    }
  }, assert.AssertionError);
});

test('masque un IBAN espacé ou non', () => {
  for (const written of ['FR7630006000011234567890189', 'FR76 3000 6000 0112 3456 7890 189']) {
    assert.equal(mask(`account ${written} please`), 'account [iban] please', written);
  }
});

test('INFIRMÉ : un IBAN compte « up to thirty alphanumerics » après la clé ; le motif en accepte 28, un IBAN russe de 33 caractères passe', async () => {
  const russian = 'RU0304452522540817810538091310419';
  assert.ok(ibanChecksumIsValid(russian));
  await assert.rejects(async () => {
    assert.equal(mask(`compte ${russian}`), 'compte [iban]');
  }, assert.AssertionError);
});

test('un IBAN de vingt-huit caractères après la clé est masqué', () => {
  const saintLucia = 'LC55HEMM000100010012001200023015';
  assert.ok(ibanChecksumIsValid(saintLucia));
  assert.equal(mask(`compte ${saintLucia}`), 'compte [iban]');
});

test('laisse le texte ordinaire intact', () => {
  const text = 'The meeting is at 10, room 4, bring the 2024 report.';
  assert.equal(mask(text), text);
});

test('la normalisation replie les espaces de la typographie française', () => {
  for (const space of [' ', ' ', ' ', ' ', ' ', '⁠']) {
    assert.equal(normalise(`06${space}12`), '06 12', space.codePointAt(0).toString(16));
    assert.equal(mask(['06', '12', '34', '56', '78'].join(space)), '[phone]');
  }
});

test('le repli de compatibilité ramène les chiffres pleine largeur', () => {
  assert.equal(normalise('０６ １２'), '06 12');
  assert.equal(mask('appelle au ０６ １２ ３４ ５６ ７８'), 'appelle au [phone]');
  assert.equal(mask('jean＠example.com'), '[email]');
});

test('INFIRMÉ : les liants invisibles deviennent une espace ; seul U+2060 l’est, U+200D reste et le numéro passe', async () => {
  await assert.rejects(async () => {
    assert.equal(normalise('06‍12'), '06 12');
    assert.equal(mask('06‍12‍34‍56‍78'), '[phone]');
  }, assert.AssertionError);
});

test("la normalisation garde les caractères d'une adresse", () => {
  const address = 'jean.du-pont+chat@exemple.fr';
  assert.equal(normalise(address), address);
  assert.equal(mask(`écris à ${address}`), 'écris à [email]');
});

test("l'ordre des motifs compte pour une adresse qui contient un numéro", () => {
  // Les motifs ne sont pas exportés en JavaScript : on vérifie le résultat de l'ordre retenu.
  assert.equal(mask('jean0612345678@example.com'), '[email]');
});

test('une étiquette nomme ce qui a été retiré', () => {
  assert.equal(mask('jean@example.com, 06 12 34 56 78, FR76 3000 6000 0112 3456 7890 189'), '[email], [phone], [iban]');
});

test("n0 n'emploie aucune dépendance", () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test('n0 est déterministe', () => {
  const message = 'Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr';
  assert.equal(new Set(Array.from({ length: 50 }, () => mask(message))).size, 1);
});

test('un message se masque en une fraction de milliseconde', () => {
  const message = 'Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr';
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) mask(message);
    runs.push((performance.now() - start) / 100);
  }
  assert.ok(Math.min(...runs) < 1);
});

test("l'essai masque ses trois premiers cas et laisse passer le numéro en lettres", () => {
  const [c1, c2, c3, c4] = essai.cases;
  assert.equal(mask(c1.input.fr), 'Bonjour, appelez-moi au [phone] ou écrivez à [email]');
  assert.equal(mask(c1.input.en), 'Hello, call me on [phone] or write to [email]');
  assert.equal(mask(c2.input.fr), 'Le virement part sur [iban], dis-moi si ça arrive');
  assert.equal(mask(c2.input.en), 'The transfer goes to [iban], tell me when it lands');
  assert.equal(mask(c3.input.fr), 'mon num c’est [phone], appelle quand tu veux');
  assert.equal(mask(c3.input.en), 'my number is [phone], call whenever');
  assert.equal(c4.fails, true);
  for (const spelled of [c4.input.fr, c4.input.en]) {
    assert.doesNotMatch(spelled, /\d/);
    assert.equal(mask(spelled), spelled);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une chaîne vide rend une chaîne vide', () => {
  assert.equal(mask(''), '');
});

test("production : mille messages d'un bloc terminent vite", () => {
  const message = 'Bonjour, appelez-moi au 06 12 34 56 78 ou écrivez à marie.durand@exemple.fr. ';
  const start = performance.now();
  const out = mask(message.repeat(1000));
  assert.ok(performance.now() - start < 1000);
  assert.equal(out.split('[phone]').length - 1, 1000);
  assert.equal(out.split('[email]').length - 1, 1000);
});

test('DÉFAUT : une suite de 30 000 caractères de mot sans @ prend un temps quadratique', async () => {
  await assert.rejects(async () => {
    const start = performance.now();
    mask('a'.repeat(30_000));
    assert.ok(performance.now() - start < 200);
  }, assert.AssertionError);
});

test("DÉFAUT : l'espace sans chasse U+200B et le trait d'union conditionnel U+00AD laissent passer un numéro", async () => {
  await assert.rejects(async () => {
    for (const invisible of ['​', '­']) {
      assert.equal(mask(['06', '12', '34', '56', '78'].join(invisible)), '[phone]');
    }
  }, assert.AssertionError);
});

test('DÉFAUT : un message sans coordonnée ressort réécrit par NFKC (« … », « m² », « ﬁ », espace insécable)', async () => {
  await assert.rejects(async () => {
    const text = 'Merci… à bientôt ! La pièce fait 20 m², ﬁn du devis.';
    assert.equal(mask(text), text);
  }, assert.AssertionError);
});

test('DÉFAUT : un IBAN tapé en minuscules passe en clair', async () => {
  await assert.rejects(async () => {
    assert.equal(mask('compte fr76 3000 6000 0112 3456 7890 189'), 'compte [iban]');
  }, assert.AssertionError);
});

test('DÉFAUT : le format international « +33 (0)6 12 34 56 78 » passe en clair', async () => {
  await assert.rejects(async () => {
    assert.equal(mask('tel +33 (0)6 12 34 56 78'), 'tel [phone]');
  }, assert.AssertionError);
});

test('DÉFAUT : une adresse accentuée passe en clair ou à moitié (\\w sans drapeau u ne couvre que l’ASCII)', async () => {
  // « josé@exemple.fr » ressort intact ; « marie.hélène@exemple.fr » ressort « marie.hélè[email] ».
  await assert.rejects(async () => {
    for (const address of ['josé@exemple.fr', 'marie.hélène@exemple.fr', 'marie.hélène@exemple.fr'.normalize('NFD')]) {
      assert.equal(mask(`écris à ${address}`), 'écris à [email]', address);
    }
  }, assert.AssertionError);
});

test("production : marque d'ordre des octets et casse mixte", () => {
  assert.equal(mask('﻿06 12 34 56 78'), '﻿[phone]');
  assert.equal(mask('Jean.Dupont@Example.COM'), '[email]');
});

test('production : un numéro à exactement dix chiffres', () => {
  assert.equal(mask('n 0612345678'), 'n [phone]');
  assert.equal(mask('n 061234567'), 'n 061234567');
  assert.equal(mask('n 06123456789'), 'n 06123456789');
  assert.equal(mask('n 00 12 34 56 78'), 'n 00 12 34 56 78');
});
