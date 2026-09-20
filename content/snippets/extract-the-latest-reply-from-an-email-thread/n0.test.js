import test from 'node:test';
import assert from 'node:assert/strict';

import ReferenceParser from 'email-reply-parser';

import { extractReply } from './n0.js';

// Le fil ordinaire : une réponse au-dessus, la citation dessous, telle que
// l'écrivent Gmail, Thunderbird et à peu près tout le reste.
const FIL_FR = `Bonjour Marie,

Le devis est signé, vous pouvez lancer la production.

Bien à vous,
Jean Dupont

Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Bonjour Jean,
>
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
>
> Cordialement,
> Marie
`;

const FIL_EN = `Hi Marie,

The quote is signed, you can start production.

Best,
Jean

On Oct 10, 2026, at 1:55 PM, Marie Martin <marie@exemple.fr> wrote:
> Hi Jean,
>
> Could you confirm quote DV-2026-118 before Friday?
>
> Regards,
> Marie
`;

// Outlook ne préfixe rien : il pose un trait et recopie les en-têtes.
const FIL_OUTLOOK_FR = `Bonjour Marie,

C'est noté, je m'en occupe.

Jean

________________________________
De : Marie Martin <marie@exemple.fr>
Envoyé : jeudi 10 octobre 2026 13:55
À : Jean Dupont <jean@exemple.fr>
Objet : RE: Devis DV-2026-118

Bonjour Jean,
Pouvez-vous confirmer le devis avant vendredi ?
Marie
`;

// La réponse est écrite entre les lignes citées, sous chaque question.
const FIL_INTERCALE = `Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
Oui, il est signé de ce matin.
> Et la livraison est-elle toujours prévue le 20 ?
Non, le 22 : le transporteur a décalé la tournée.
`;

// La réponse est écrite sous la citation, en entier.
const FIL_SOUS = `Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Bonjour Jean,
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
> Cordialement,
> Marie

Bonjour Marie,

Le devis est signé, vous pouvez lancer la production dès lundi.

Bien à vous,
Jean Dupont
`;

// Gmail replie la ligne d'attribution quand elle est longue.
const FIL_REPLIE = `Bonjour Marie,

C'est d'accord.

Le mer. 10 oct. 2026 à 13:55, Marie Martin
<marie.martin@service-achats.exemple.fr> a
écrit :
> Pouvez-vous confirmer ?
`;

const FIL_ORIGINE = `Merci, c'est reçu.

-----Message d'origine-----
De : Marie Martin
Objet : Devis

Bonjour Jean,
`;

const FIL_SANS_CITATION = `Bonjour Marie,

Le devis est signé.

Bien à vous,
Jean Dupont
`;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : une réponse écrite dans la citation n'est pas au-dessus", () => {
  const rapport = extractReply(FIL_INTERCALE);
  assert.equal(rapport.reply, '');
  assert.ok(FIL_INTERCALE.includes('Oui, il est signé de ce matin.'));
  // Rien n'est rendu, mais rien n'est affirmé non plus : le rapport le dit.
  assert.equal(rapport.reason, 'more text was written under the quote than above it');
  assert.equal(extractReply(FIL_SOUS).reply, '');
  assert.notEqual(extractReply(FIL_SOUS).reason, null);
});

test('point de rupture : témoin, le fil ordinaire revient entier', () => {
  const rapport = extractReply(FIL_FR);
  assert.equal(rapport.reply, 'Bonjour Marie,\n\nLe devis est signé, vous pouvez '
    + 'lancer la production.\n\nBien à vous,\nJean Dupont');
  assert.equal(rapport.reason, null);
});

// ---------------------------------------------------------------------------
// Le verdict, confronté à la bibliothèque de référence
// ---------------------------------------------------------------------------

test('verdict : la bibliothèque de référence retire en français une signature '
  + "qu'elle garde en anglais", () => {
  const visible = (fil) => new ReferenceParser().read(fil).getVisibleText();
  // « Bien . vous,?!? » est dans sa liste de formules de politesse, « Best, » non.
  assert.ok(!visible(FIL_FR).includes('Jean Dupont'));
  assert.ok(visible(FIL_EN).includes('Jean'));
  // L'extrait de la fiche garde la signature des deux côtés.
  assert.ok(extractReply(FIL_FR).reply.endsWith('Jean Dupont'));
  assert.ok(extractReply(FIL_EN).reply.endsWith('Jean'));
  // Ce qu'elle fait bien, et que son homologue Python ne fait pas : couper
  // l'en-tête de citation français.
  assert.ok(!visible(FIL_FR).includes('a écrit'));
  assert.ok(!extractReply(FIL_FR).reply.includes('a écrit'));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les quatre familles de marqueurs sont reconnues', () => {
  assert.equal(extractReply(FIL_FR).quoted_from_line, 7);
  assert.equal(extractReply(FIL_OUTLOOK_FR).quoted_from_line, 6);
  assert.equal(extractReply(FIL_ORIGINE).quoted_from_line, 2);
  assert.equal(extractReply('Bonjour\n> cité').quoted_from_line, 1);
});

test('une attribution repliée sur trois lignes est reconnue', () => {
  assert.equal(extractReply(FIL_REPLIE).reply, "Bonjour Marie,\n\nC'est d'accord.");
});

test("la signature n'est pas retirée", () => {
  assert.ok(extractReply(FIL_OUTLOOK_FR).reply.endsWith('\nJean'));
  assert.equal(extractReply('Jean\n> cité').reply, 'Jean');
});

test('un fil sans citation revient entier et sans coupe', () => {
  const rapport = extractReply(FIL_SANS_CITATION);
  assert.equal(rapport.reply, FIL_SANS_CITATION.trim());
  assert.equal(rapport.quoted_from_line, null);
  assert.equal(rapport.reason, null);
});

test("sous un bloc recopié, rien ne distingue une réponse de l'ancien message", () => {
  assert.equal(extractReply(FIL_OUTLOOK_FR).reason, null);
  const sousOutlook = FIL_OUTLOOK_FR.replace("Bonjour Marie,\n\nC'est noté, je m'en occupe.\n\nJean\n", '');
  assert.equal(extractReply(sousOutlook).reply, '');
  assert.equal(extractReply(sousOutlook).reason, null); // et personne ne le sait
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = extractReply(entree);
    assert.equal(rapport.reply, '');
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un fil de deux messages', () => {
  assert.ok(extractReply(FIL_FR).reply.startsWith('Bonjour Marie,'));
  assert.ok(extractReply(FIL_EN).reply.startsWith('Hi Marie,'));
});

test('production : entrée vide', () => {
  assert.deepEqual(extractReply(''), { reply: '', quoted_from_line: null, reason: null });
  assert.equal(extractReply('\n\n\n').reply, '');
});

test('production : entrée très grande et terminaison rapide', () => {
  let enorme = FIL_FR;
  const lignes = [];
  for (let n = 0; n < 200_000; n += 1) lignes.push(`> ligne ${n}`);
  enorme += lignes.join('\n');
  const debut = performance.now();
  const rapport = extractReply(enorme);
  assert.ok(performance.now() - debut < 10_000);
  assert.ok(rapport.reply.endsWith('Jean Dupont'));
});

test('production : encodages inattendus', () => {
  assert.ok(extractReply(FIL_FR.replaceAll('\n', '\r\n')).reply.endsWith('Jean Dupont'));
  assert.ok(extractReply(FIL_FR.replaceAll('\n', '\r')).reply.endsWith('Jean Dupont'));
  const insecable = 'Bonjour, \n\nLe devis est signé.\n\n> cité';
  assert.ok(extractReply(insecable).reply.includes(' '));
  assert.equal(extractReply('﻿Bonjour\n> cité').reply, 'Bonjour');
});

test('production : valeurs aux limites', () => {
  assert.equal(extractReply('> tout est cité').quoted_from_line, 0);
  assert.equal(extractReply("2 > 1, donc c'est bon.").quoted_from_line, null);
  assert.equal(extractReply('Le devis est signé.\n> cité').reply, 'Le devis est signé.');
  assert.equal(extractReply('Reçu de : Marie.').quoted_from_line, null);
  assert.equal(extractReply('Merci.\nDe : Marie').quoted_from_line, 1);
});

test("production : un fil illisible n'empêche pas de lire les autres", () => {
  const lot = [FIL_FR, null, FIL_EN];
  const rapports = lot.map(extractReply);
  assert.deepEqual(rapports.map((r) => Boolean(r.reply)), [true, false, true]);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) extractReply(FIL_FR);
  assert.ok(performance.now() - debut < 20_000);
});
