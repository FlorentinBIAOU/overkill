import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HONEYPOT_FIELD, MAXIMUM_LINKS, MINIMUM_SECONDS, fold, isSpam, reasons } from './n0.js';

const GENUINE = {
  name: 'Claire Dubois',
  email: 'claire@example.com',
  message: 'Hello, I ordered a lamp last week and it arrived damaged. What should I do?',
  website: '',
};

const PATIENT_BOT_EN = 'Good morning, I came across your company and I would like to discuss '
  + 'a partnership to increase your visibility. When would suit you?';
const PATIENT_BOT_FR = 'Bonjour, je découvre votre société et je souhaiterais discuter d’un '
  + 'partenariat pour accroître votre visibilité.';
const VERDICT_SOLICITATION = 'Hi, we can boost your google ranking with quality links, cheap offer.';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un robot patient qui évite les liens', () => {
  const patientBot = { name: 'Growth Team', email: 'outreach@example.com', message: PATIENT_BOT_EN, website: '' };
  assert.deepEqual(reasons(patientBot, 30), []);
  assert.ok(!isSpam(patientBot, 30));
});

test('point de rupture : la phrase citée en français passe aussi', () => {
  assert.deepEqual(reasons({ message: PATIENT_BOT_FR, website: '' }, 30), []);
});

test('point de rupture : témoin, chacun des quatre contrôles est vivant', () => {
  const base = { message: PATIENT_BOT_EN, website: '' };
  assert.deepEqual(reasons({ ...base, website: 'x' }, 30), ['honeypot filled']);
  assert.deepEqual(reasons(base, 1), ['submitted too fast']);
  assert.deepEqual(reasons({ ...base, message: `${PATIENT_BOT_EN} http://a.com http://b.com http://c.com` }, 30), ['too many links']);
  assert.deepEqual(reasons({ ...base, message: `${PATIENT_BOT_EN} guest post` }, 30), ['banned phrase: guest post']);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('accepte une vraie demande', () => {
  assert.deepEqual(reasons(GENUINE, 42), []);
  assert.ok(!isSpam(GENUINE, 42));
});

test('attrape un pot de miel rempli', () => {
  assert.deepEqual(reasons({ ...GENUINE, website: 'http://example.com' }, 42), ['honeypot filled']);
  assert.equal(HONEYPOT_FIELD, 'website');
});

test('attrape un envoi plus rapide qu’un humain', () => {
  assert.ok(reasons(GENUINE, 0.4).includes('submitted too fast'));
});

test('deux contrôles regardent l’expéditeur, pas le texte', () => {
  for (const message of ['', GENUINE.message, 'backlink casino '.repeat(3)]) {
    assert.deepEqual(reasons({ message, website: 'filled' }, 0.1).slice(0, 2), ['honeypot filled', 'submitted too fast']);
  }
});

test('attrape un mur de liens', () => {
  const message = 'visit http://a.com and www.b.net and http://c.org and d.xyz';
  assert.ok(reasons({ ...GENUINE, message }, 42).includes('too many links'));
});

test('tolère le lien qu’un client envoie vraiment', () => {
  assert.deepEqual(reasons({ ...GENUINE, message: 'the page http://example.com/order-4512 shows an error' }, 42), []);
});

test('compte un lien une fois et non une fois par morceau', () => {
  const message = 'see http://example.com/a and http://example.com/b for the two photos';
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
  const naive = /https?:\/\/|(?:www\.)\S+|\b[\w-]+\.(?:com|net|org|ru|xyz|top)\b/g;
  assert.equal(message.match(naive).length, 4);
});

test('nomme la phrase interdite trouvée', () => {
  assert.deepEqual(reasons({ ...GENUINE, message: 'We sell cheap backlink packages for your site.' }, 42), ['banned phrase: backlink']);
});

test('le repli survit à la casse et aux accents', () => {
  assert.equal(fold('Rétrolien'), fold('RETROLIEN'));
  assert.equal(fold('BÁCKLÎNK'), 'backlink');
  assert.ok(reasons({ ...GENUINE, message: 'Cheap BÁCKLÎNKS, best prices.' }, 42).includes('banned phrase: backlink'));
});

test('un rejet vient avec ses motifs, une liste vide veut dire accepter', () => {
  const fields = { message: 'casino crypto http://a.com http://b.com http://c.com', website: 'x' };
  assert.deepEqual(reasons(fields, 0), [
    'honeypot filled', 'submitted too fast', 'too many links', 'banned phrase: casino', 'banned phrase: crypto',
  ]);
  assert.equal(isSpam(fields, 0), true);
  assert.equal(isSpam(GENUINE, 42), false);
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test('verdict : la sollicitation réelle traverse les quatre contrôles', () => {
  assert.deepEqual(reasons({ message: VERDICT_SOLICITATION, website: '' }, 30), []);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : formulaire vide et message d’un mégaoctet', () => {
  assert.deepEqual(reasons({}, 42), []);
  const started = Date.now();
  assert.deepEqual(reasons({ ...GENUINE, message: 'I have a question about my order. '.repeat(30000) }, 42), []);
  assert.ok(Date.now() - started < 2000);
});

test('production : limites du délai et du plafond de liens', () => {
  assert.equal(MINIMUM_SECONDS, 3);
  assert.equal(MAXIMUM_LINKS, 2);
  assert.deepEqual(reasons(GENUINE, 2.999), ['submitted too fast']);
  assert.deepEqual(reasons(GENUINE, 3), []);
  assert.deepEqual(reasons({ ...GENUINE, message: 'http://a.com http://b.com' }, 42), []);
  assert.deepEqual(reasons({ ...GENUINE, message: 'http://a.com http://b.com http://c.com' }, 42), ['too many links']);
});

test('production : un pot de miel d’espaces compte comme vide', () => {
  assert.deepEqual(reasons({ ...GENUINE, website: ' \t ' }, 42), []);
});

test('production : contournements du texte, espace de largeur nulle et homoglyphe', () => {
  assert.deepEqual(reasons({ message: 'back​links cheap' }, 42), []);
  assert.deepEqual(reasons({ message: 'bаcklinks cheap' }, 42), []);
  assert.deepEqual(reasons({ message: 'ｂａｃｋｌｉｎｋ' }, 42), ['banned phrase: backlink']);
  assert.deepEqual(reasons({ message: 'BÁCKLINK'.normalize('NFD') }, 42), ['banned phrase: backlink']);
});

test('production : constat, le repli JavaScript retire l’accent circonflexe ASCII', () => {
  // « back^link » est rejeté ici et passe en Python : \p{Diacritic} couvre « ^ ».
  assert.equal(fold('back^link'), 'backlink');
  assert.deepEqual(reasons({ message: 'back^link' }, 42), ['banned phrase: backlink']);
});

test('des adresses électroniques comptent comme des liens', async () => {
  const message = 'Write to me at claire@example.com or claire.dubois@gmail.com, or my colleague paul@example.org';
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
});

test('une phrase interdite est trouvée à l’intérieur d’un mot', async () => {
  for (const message of ['J\'ai acheté ce produit au Géant Casino de Nantes.', 'Votre module de cryptographie est-il certifié ?']) {
    assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
  }
});

test('un délai NaN passe le contrôle de vitesse', async () => {
  assert.deepEqual(reasons(GENUINE, NaN), ['submitted too fast']);
});

test('un message conçu fait exploser le motif des liens', async () => {
  // Quadratique : 100 000 caractères « a-a-a-… » prennent plusieurs secondes.
  const started = Date.now();
  reasons({ ...GENUINE, message: 'a-'.repeat(50000) }, 42);
  assert.ok(Date.now() - started < 1000);
});
