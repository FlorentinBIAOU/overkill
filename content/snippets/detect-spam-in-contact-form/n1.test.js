/**
 * L'essai interactif, qui importe cet extrait, est testé en fin de fichier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reasons } from './n0.js';
import { fold, isSpam, spamScore, train } from './n1.js';
import essai from '../../tryouts/live/detect-spam-in-contact-form.js';

const SPAM = [
  'Hello, we offer guaranteed first page ranking on Google for your website.',
  'Boost your traffic with our premium backlink packages at cheap prices.',
  'Dear sir, I can improve your website ranking within one month, low cost.',
  'Earn passive income trading crypto, join our telegram channel right now.',
  'We provide guest posting services on high authority blogs, best rates.',
  'Buy cheap followers and likes for your social media accounts today.',
  'Your website design looks outdated, we redesign it for a very low price.',
  'Congratulations, you have won a prize, click the link below to claim it.',
  'We are an offshore web development company, hire our developers cheap.',
  'Increase your sales with our bulk email marketing database of contacts.',
  'Dear owner, your domain is expiring, renew it today at a discount price.',
  'We sell verified leads for your industry, guaranteed results, free trial.',
  'Hello dear, I have a business proposal worth millions, reply for details.',
  'Get thousands of visitors to your website every month, no effort needed.',
  'Our agency offers unlimited traffic and top rankings, first month free.',
  'Special offer this week only, cheap logo design and unlimited revisions.',
];

const GENUINE = [
  'Hello, I ordered a lamp last week and it arrived damaged, what should I do?',
  'Could you tell me if the workshop on tuesday is still open for registration?',
  'I would like a quote for repainting the shutters of a house near Nantes.',
  'Your online form refused my postcode, I live abroad, can you help me?',
  'Good morning, is the shop open on saturday afternoon during august?',
  'I sent an invoice three weeks ago and it is still unpaid, who do I contact?',
  'Do you deliver to Belgium, and how long does the delivery usually take?',
  'The instructions in the manual mention a part that was not in the box.',
  'I lost the receipt for a purchase made in june, can you send a copy?',
  'Hello, my order number 4512 has not moved for ten days, is it lost?',
  'Is the blue model still available in size medium, or is it discontinued?',
  'We are a school and would like to visit your workshop with fifteen pupils.',
  'The battery of the device I bought in march no longer holds a charge.',
  'Can I change the delivery address of an order that was placed yesterday?',
  'Hello, I would like to cancel my subscription before the next renewal.',
  'Your newsletter arrives twice, could you remove the duplicate address?',
];

const LABELS = [...SPAM.map(() => 1), ...GENUINE.map(() => 0)];
const model = train([...SPAM, ...GENUINE], LABELS);

const PATIENT_BOT = 'Good morning, I came across your company and I would like to discuss '
  + 'a partnership to increase your visibility. When would suit you?';
const VERDICT_SOLICITATION = 'Hi, we can boost your google ranking with quality links, cheap offer.';
const ENQUIRY = 'Hello, my parcel arrived yesterday but the box was open.';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une sollicitation écrite dans le registre d’un client', () => {
  assert.ok(spamScore(model, PATIENT_BOT) < 0.5);
  assert.ok(!isSpam(model, PATIENT_BOT));
  assert.ok(spamScore(model, VERDICT_SOLICITATION) > 0.5);
});

test('point de rupture : c’est mot pour mot le message qui traverse N0', () => {
  assert.deepEqual(reasons({ message: PATIENT_BOT, website: '' }, 30), []);
  assert.ok(!isSpam(model, PATIENT_BOT));
});

test('point de rupture : ce que N1 gagne est le flot entre les deux', () => {
  assert.deepEqual(reasons({ message: VERDICT_SOLICITATION, website: '' }, 30), []);
  assert.ok(isSpam(model, VERDICT_SOLICITATION));
  assert.deepEqual(reasons({ message: ENQUIRY, website: 'http://x.com' }, 0.2), ['honeypot filled', 'submitted too fast']);
  assert.ok(!isSpam(model, ENQUIRY));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le repli retire la casse et les accents', () => {
  assert.equal(fold('Commande Cassée'), 'commande cassee');
  assert.equal(spamScore(model, ENQUIRY.toUpperCase()), spamScore(model, ENQUIRY));
});

test('verdict : attrape une sollicitation jamais vue', () => {
  assert.ok(![...SPAM, ...GENUINE].includes(VERDICT_SOLICITATION));
  assert.ok(isSpam(model, VERDICT_SOLICITATION));
});

test('laisse passer une nouvelle demande de client', () => {
  assert.ok(!isSpam(model, ENQUIRY));
});

test('attrape les phrases où figurent les graphies contournées', () => {
  for (const written of [
    'we sell b a c k l i n k s and cheap traffic, boost your rankings today',
    'we sell backl1nks and cheap seo packages, boost your ranking now',
  ]) {
    assert.ok(isSpam(model, written), written);
  }
});

test('INFIRMÉ : les graphies contournées survivent aux n-grammes', async () => {
  // Ici, ni « b a c k l i n k s » (0,377) ni « backl1nks » (0,394) ne scorent
  // plus qu'un mot neutre (« l a m p s » 0,461, « lamps » 0,619) ; dans les
  // phrases, le mot neutre fait autant ou plus.
  await assert.rejects(async () => {
    assert.ok(spamScore(model, 'b a c k l i n k s') > spamScore(model, 'l a m p s'));
  });
  await assert.rejects(async () => {
    assert.ok(spamScore(model, 'backl1nks') > spamScore(model, 'lamps'));
    assert.ok(spamScore(model, 'we sell backl1nks and cheap seo packages, boost your ranking now')
      > spamScore(model, 'we sell lamps and cheap seo packages, boost your ranking now'));
  });
});

test('le hachage : aucun vocabulaire à construire ni à livrer', () => {
  assert.deepEqual(Object.keys(model).sort(), ['bias', 'idf', 'weights']);
  assert.equal(model.weights.length, 1024);
});

test('INFIRMÉ : un n-gramme que tout message porte « says nothing »', async () => {
  // L'IDF lissé lui donne 1, contre ln((n+1)/2) + 1 au plus rare.
  const corpus = ['hello cheap offer', 'hello my order', 'hello the lamp', 'hello seo traffic'];
  const small = train(corpus, [1, 0, 0, 1], { epochs: 1 });
  assert.equal(Math.min(...small.idf), 1);
  await assert.rejects(async () => assert.equal(Math.min(...small.idf), 0));
});

test('le seuil est à vous', () => {
  assert.ok(isSpam(model, ENQUIRY, 0));
  assert.ok(!isSpam(model, VERDICT_SOLICITATION, 1));
  assert.ok(isSpam(model, VERDICT_SOLICITATION, spamScore(model, VERDICT_SOLICITATION)));
});

test('le score est une probabilité', () => {
  for (const message of [...SPAM, ...GENUINE, 'anything at all', '']) {
    const score = spamScore(model, message);
    assert.ok(score >= 0 && score <= 1);
  }
});

test('deux entraînements rendent les mêmes scores', () => {
  assert.equal(spamScore(train([...SPAM, ...GENUINE], LABELS), PATIENT_BOT), spamScore(model, PATIENT_BOT));
});

test('l’extrait n’importe rien', () => {
  assert.doesNotMatch(readFileSync(new URL('./n1.js', import.meta.url), 'utf8'), /^\s*import\s/m);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : accents, NFD, espace insécable et message d’un mégaoctet', () => {
  assert.ok(!isSpam(model, 'Bonjour, ma commande est arrivée cassée, que dois-je faire ?'));
  assert.equal(spamScore(model, `${ENQUIRY} é`.normalize('NFD')), spamScore(model, `${ENQUIRY} é`));
  assert.ok(!isSpam(model, ENQUIRY.replaceAll(' ', ' ')));
  assert.ok(!isSpam(model, 'Hello, I ordered a lamp last week and it arrived damaged. '.repeat(20)));
  const started = Date.now();
  spamScore(model, 'Hello I have a question. '.repeat(40000));
  assert.ok(Date.now() - started < 10_000);
});

test('un message vide n’est pas tranché par hasard', async () => {
  // 0,454 ici, 0,509 en Python.
  assert.ok(!isSpam(model, ''));
  assert.ok(spamScore(model, '') < 0.5 - 0.05);
});

test('production : un entraînement dégénéré lève', () => {
  // Jeu vide, une seule classe, étiquettes de longueur différente : trois façons
  // de rendre un modèle qui répond n'importe quoi sans le dire. Python lève de
  // même, sur les mêmes trois cas.
  const message = /one label per message, and both classes/;
  assert.throws(() => train([], []), { name: 'RangeError', message });
  assert.throws(() => train(SPAM, SPAM.map(() => 1)), { name: 'RangeError', message });
  assert.throws(() => train([...SPAM, ...GENUINE], [1]), { name: 'RangeError', message });
});

test('production : trois mille deux cents envois étiquetés', () => {
  const started = Date.now();
  train(Array(100).fill([...SPAM, ...GENUINE]).flat(), Array(100).fill(LABELS).flat(), { epochs: 30 });
  assert.ok(Date.now() - started < 60_000);
});

// ---------------------------------------------------------------------------
// L'essai interactif (niveau N1)
// ---------------------------------------------------------------------------

const run = (i, lang) => essai.run(essai.cases[i].input[lang], lang);

test('essai : la note dit juste, 32 envois dont 16 spams, entraînés dans la page', () => {
  assert.equal(run(0, 'fr').note, 'Modèle entraîné sur 32 envois étiquetés, dont 16 spams.');
  const source = readFileSync(new URL('../../tryouts/live/detect-spam-in-contact-form.js', import.meta.url), 'utf8');
  assert.deepEqual(source.match(/^import .*$/gm), ["import { spamScore, train } from '../../snippets/detect-spam-in-contact-form/n1.js';"]);
  for (const name of ['SPAM_FR', 'LEGITIMES_FR', 'SPAM_EN', 'LEGITIMES_EN']) {
    const block = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))[1];
    assert.equal(block.match(/^\s+'/gm).length, 16, name);
  }
});

test('essai : une offre de référencement jamais vue est écartée', () => {
  assert.deepEqual(run(0, 'fr').verdict, { label: 'Écarté comme spam', detail: 'Score de spam 0,90, au-dessus du seuil de 0,50.' });
  assert.deepEqual(run(0, 'en').verdict, { label: 'Turned away as spam', detail: 'Spam score 0.97, above the 0.50 threshold.' });
});

test('essai : un client dont le colis est abîmé passe', () => {
  assert.equal(run(1, 'fr').verdict.label, 'Passe : demande à lire');
  assert.equal(run(1, 'en').verdict.label, 'Let through: an enquiry to read');
});

test('essai : le même démarchage, lettres espacées, est écarté', () => {
  assert.equal(run(2, 'fr').verdict.label, 'Écarté comme spam');
  assert.equal(run(2, 'en').verdict.label, 'Turned away as spam');
});

test('constat : dans le cas « lettres espacées », le mot espacé n’apporte presque rien', () => {
  // 0,97 avec « l i e n s », 0,96 avec « l a m p e s », 0,98 sans le mot.
  const detail = (message) => essai.run(message, 'fr').verdict.detail;
  assert.equal(detail(essai.cases[2].input.fr), 'Score de spam 0,97, au-dessus du seuil de 0,50.');
  assert.equal(detail('nous vendons des l a m p e s retours et du trafic pas cher, boostez votre référencement'), 'Score de spam 0,96, au-dessus du seuil de 0,50.');
  assert.equal(detail('nous vendons des retours et du trafic pas cher, boostez votre référencement'), 'Score de spam 0,98, au-dessus du seuil de 0,50.');
});

test('essai : le robot patient passe, en français comme en anglais', () => {
  assert.equal(essai.cases[3].fails, true);
  assert.deepEqual(run(3, 'fr').verdict, { label: 'Passe : demande à lire', detail: 'Score de spam 0,32, en dessous du seuil de 0,50.' });
  assert.deepEqual(run(3, 'en').verdict, { label: 'Let through: an enquiry to read', detail: 'Spam score 0.07, below the 0.50 threshold.' });
  assert.deepEqual(reasons({ message: essai.cases[3].input.fr, website: '' }, 30), []);
});
