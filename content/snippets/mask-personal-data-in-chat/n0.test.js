import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mask, normalise } from './n0.js';

const SOURCE = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
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
  const reference = 'DE 86 3456 7890 1234';
  assert.ok(ibanChecksumIsValid(reference)); // la clé tombe juste par coïncidence
  assert.equal(mask(`commande ${reference} expédiée`), 'commande [iban] expédiée');

  // Témoin : la même référence avec une autre clé n'est pas touchée ; un vrai IBAN est masqué pareil.
  assert.equal(mask('commande DE 12 3456 7890 1234 expédiée'), 'commande DE 12 3456 7890 1234 expédiée');
  assert.equal(mask('commande 86 3456 7890 1234 expédiée'), 'commande 86 3456 7890 1234 expédiée');
  assert.ok(ibanChecksumIsValid('FR76 3000 6000 0112 3456 7890 189'));
  assert.equal(mask('compte FR76 3000 6000 0112 3456 7890 189'), 'compte [iban]');
});

test('point de rupture : sur les cent clés de la référence, une seule est masquée', () => {
  const keys = Array.from({ length: 100 }, (_, k) => String(k).padStart(2, '0'));
  assert.deepEqual(keys.filter((k) => mask(`DE ${k} 3456 7890 1234`) === '[iban]'), ['86']);
  assert.deepEqual(keys.filter((k) => ibanChecksumIsValid(`DE${k}345678901234`)), ['86']);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('masque une adresse électronique', () => {
  assert.equal(mask('write to me at jean.dupont@example.com'), 'write to me at [email]');
});

test('masque un numéro avec espace, point, tiret, barre ou sans séparateur', () => {
  for (const written of [
    '0612345678', '06 12 34 56 78', '06.12.34.56.78', '06-12-34-56-78', '06/12/34/56/78',
    '+33 6 12 34 56 78', '+33612345678', '+33 (0)6 12 34 56 78',
  ]) {
    assert.equal(mask(`call me on ${written}`), 'call me on [phone]', written);
  }
});

test('le motif de téléphone tolère un ou deux séparateurs, pas trois', () => {
  for (const written of ['06 12  34 56 78', '06//12//34//56//78', '06. 12 34 56 78', '06 /12 34 56 78', '+33  (0) 6.12.34.56.78']) {
    assert.equal(mask(`call me on ${written}`), 'call me on [phone]', written);
  }
  // Limite : trois séparateurs à la suite ne sont plus un numéro.
  for (const written of ['06   12 34 56 78', '06 . 12 34 56 78']) {
    assert.equal(mask(`call me on ${written}`), `call me on ${written}`, written);
  }
});

test('masque un IBAN espacé ou non', () => {
  for (const written of ['FR7630006000011234567890189', 'FR76 3000 6000 0112 3456 7890 189']) {
    assert.equal(mask(`account ${written} please`), 'account [iban] please', written);
  }
});

test('un IBAN russe de trente-trois caractères est masqué, groupé ou non', () => {
  const russian = 'RU0304452522540817810538091310419';
  assert.ok(ibanChecksumIsValid(russian));
  assert.equal(mask(`compte ${russian}`), 'compte [iban]');
  assert.equal(mask('compte RU03 0445 2522 5408 1781 0538 0913 1041 9'), 'compte [iban]');
});

test('la clé décide, pas le motif : limites de longueur', () => {
  assert.equal(mask('compte NO9386011117947'), 'compte [iban]');
  assert.equal(mask('compte NO93 8601 1117 947'), 'compte [iban]');
  const longest = 'XK87ABCD12345678901234567890EFGHIJ';
  assert.ok(longest.length === 34 && ibanChecksumIsValid(longest));
  assert.equal(mask(`compte ${longest}`), 'compte [iban]');
  const fourteen = 'NO698601111794';
  assert.ok(ibanChecksumIsValid(fourteen));
  assert.equal(mask(`compte ${fourteen}`), `compte ${fourteen}`);
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

test('les caractères sans chasse et le trait d’union conditionnel deviennent une espace', () => {
  for (const invisible of ['\u200b', '\u200c', '\u200d', '\u2060', '\u00ad', '\ufeff']) {
    const code = invisible.codePointAt(0).toString(16);
    assert.equal(normalise(`06${invisible}12`), '06 12', code);
    assert.equal(mask(['06', '12', '34', '56', '78'].join(invisible)), '[phone]', code);
  }
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

test('les étiquettes sont posées dans le message tel qu’il a été écrit', () => {
  assert.equal(mask('Merci… appelle au 06\u202f12\u202f34\u202f56\u202f78, 20 m², ﬁn'), 'Merci… appelle au [phone], 20 m², ﬁn');
  assert.equal(mask('tel\u00a006 12 34 56 78\u00a0!'), 'tel\u00a0[phone]\u00a0!');
  assert.equal(mask('au ０６ １２ ３４ ５６ ７８ ⁂'), 'au [phone] ⁂');
  // Un caractère que le repli allonge (ﷺ devient dix-huit caractères) ne décale pas l'étiquette.
  assert.equal(normalise('ﷺ').length, 18);
  assert.equal(mask('ﷺ 06 12 34 56 78 ﷺ jean@example.com'), 'ﷺ [phone] ﷺ [email]');
  // Un emoji hors du plan de base compte deux unités de code : l'étiquette tombe juste quand même.
  assert.equal(mask('😀06 12 34 56 78😀 josé@exemple.fr'), '😀[phone]😀 [email]');
});

test('un message sans coordonnée ressort inchangé, à la composition des accents près', () => {
  const text = 'Merci… à bientôt\u00a0! La pièce fait 20 m², ﬁn du devis.\u202f';
  assert.equal(mask(text), text);
  const decomposed = 'élève à côté, 20 m²'.normalize('NFD');
  assert.equal(mask(decomposed), decomposed.normalize('NFC'));
  assert.notEqual(mask(decomposed), decomposed);
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

test('production : une longue suite de lettres sans arobase se traite vite', () => {
  let start = performance.now();
  mask('a'.repeat(30_000));
  assert.ok(performance.now() - start < 200);
  start = performance.now();
  mask('a'.repeat(300_000));
  assert.ok(performance.now() - start < 3000);
});

test('sans le regard arrière, une longue suite de lettres prend un temps quadratique', () => {
  // Commentaire : « without it, a long run of letters with no @ takes quadratic time ». Le motif est lu dans la source.
  const [, body, flags] = SOURCE.match(/const EMAIL = \/(.+)\/(\w*);/);
  const lookbehind = '(?<![\\p{L}\\p{N}_.+-])';
  assert.ok(body.startsWith(lookbehind));
  const kept = new RegExp(body, flags);
  const without = new RegExp(body.slice(lookbehind.length), flags);
  const letters = 'a'.repeat(10_000);
  const time = (pattern, text) => {
    const start = performance.now();
    text.replace(pattern, 'x');
    return performance.now() - start;
  };
  assert.equal(mask(`${letters} ${letters}@example.com`), `${letters} [email]`);
  const keptTime = time(kept, letters);
  const removedTime = time(without, letters);
  assert.ok(removedTime > 20 * keptTime, `${removedTime} contre ${keptTime}`);
  assert.ok(time(without, letters.repeat(2)) > 2.5 * removedTime);
});

test('production : de longues suites de chiffres, de blocs ou de points se traitent vite', () => {
  for (const text of ['1'.repeat(300_000), `AB12 ${'ABCD '.repeat(60_000)}`, '06 '.repeat(100_000), `${'a.'.repeat(100_000)}@`, 'ﷺ'.repeat(100_000)]) {
    const start = performance.now();
    mask(text);
    assert.ok(performance.now() - start < 3000, text.slice(0, 10));
  }
});

test('production : un caractère de largeur nulle ne laisse pas passer un numéro', () => {
  for (const invisible of ['​', '­']) {
    assert.equal(mask(['06', '12', '34', '56', '78'].join(invisible)), '[phone]');
  }
});

test('production : un message sans coordonnée ressort intact', () => {
  const text = 'Merci… à bientôt ! La pièce fait 20 m², ﬁn du devis.';
  assert.equal(mask(text), text);
});

test('production : un IBAN en minuscules est masqué', () => {
  assert.equal(mask('compte fr76 3000 6000 0112 3456 7890 189'), 'compte [iban]');
  assert.equal(mask('compte gb82 west 1234 5698 7654 32'), 'compte [iban]');
  assert.equal(mask('compte Gb82 West 1234 5698 7654 32'), 'compte [iban]');
});

test('production : un IBAN suivi d’un mot est masqué, et le mot reste', () => {
  assert.equal(mask('BE68 5390 0754 7034 dans la journée'), '[iban] dans la journée');
  assert.equal(mask('BE68 5390 0754 7034 abcd ok'), '[iban] abcd ok');
  assert.equal(mask('BE68 5390 0754 7034 abc'), '[iban] abc');
});

test('production : une phrase ordinaire en minuscules n’est pas masquée', () => {
  for (const text of ['le 12 mars 2024 dans la salle', 'on se voit le 15 juin 2025 pour la fête']) {
    assert.equal(mask(text), text);
  }
});

test('DÉFAUT : une date en minuscules dont la clé tombe juste est masquée comme un IBAN (« rendez-vous [iban] la signature »)', async () => {
  await assert.rejects(async () => {
    const text = 'rendez-vous le 10 mars 2023 pour la signature';
    assert.equal(mask(text), text);
  }, assert.AssertionError);
});

test('production : le format international avec zéro entre parenthèses est masqué', () => {
  assert.equal(mask('tel +33 (0)6 12 34 56 78'), 'tel [phone]');
});

test('production : une séquence d’emoji à liant est conservée', () => {
  const family = '👨\u200d👩\u200d👧';
  assert.equal(mask(`famille ${family} 06 12 34 56 78`), `famille ${family} [phone]`);
  assert.equal(mask(`${family}jean@example.com${family}`), `${family}[email]${family}`);
});

test('production : les chiffres arabes-indiens ne sont pas lus comme des chiffres', () => {
  const text = 'tel ٠٦ ١٢ ٣٤ ٥٦ ٧٨';
  assert.equal(mask(text), text);
});

test('production : une adresse accentuée est masquée en entier', () => {
  for (const address of ['josé@exemple.fr', 'marie.hélène@exemple.fr', 'marie.hélène@exemple.fr'.normalize('NFD')]) {
    assert.equal(mask(`écris à ${address}`), 'écris à [email]', address);
  }
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
