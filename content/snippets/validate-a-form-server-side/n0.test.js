/**
 * Tests du niveau N0 : schéma déclaratif, un message d'erreur par champ.
 *
 * Le schéma vit dans le test, pas dans l'extrait : c'est une donnée d'exemple,
 * et le test Python déclare exactement le même, champ pour champ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import essai from '../../tryouts/live/validate-a-form-server-side.js';
import { check, validate } from './n0.js';

const SCHEMA = {
  email: {
    required: true,
    pattern: '[^@\\s]+@[^@\\s]+\\.[a-z]{2,}',
    message: 'is not a valid email address',
  },
  display_name: { required: true, min: 2, max: 30 },
  age: { required: true, type: 'integer', min: 18, max: 130 },
  website: { pattern: 'https?://\\S+' },
};

const VALID = {
  email: 'ada@example.com',
  display_name: 'Ada',
  age: 36,
  website: 'https://example.com',
};

const SOURCE = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une adresse bien formée qui n’existe pas', () => {
  assert.deepEqual(validate({ ...VALID, email: 'ada@no-such-mailbox.example' }, SCHEMA), {});
  assert.deepEqual(validate({ ...VALID, email: 'ada.no-such-mailbox.example' }, SCHEMA), { email: 'is not a valid email address' });
});

test('les blancs de bord tombent avant tout contrôle', () => {
  // « leading and trailing whitespace comes off every string before anything is
  // checked, and a string left empty by that is treated as absent ». Les trois
  // cas que cela règle, et qu'une règle absente laissait passer.
  assert.deepEqual(validate({ ...VALID, display_name: '  ' }, SCHEMA), { display_name: 'is required' });
  assert.deepEqual(validate({ ...VALID, email: ' ada@example.com ' }, SCHEMA), {});
  assert.deepEqual(validate({ ...VALID, display_name: ' A ' }, SCHEMA), { display_name: 'must be at least 2 characters' });
  assert.deepEqual(validate({ ...VALID, display_name: ' Ad ' }, SCHEMA), {});
  // Ce qui n'est pas une chaîne n'est pas touché.
  assert.deepEqual(validate({ ...VALID, age: 36 }, SCHEMA), {});
});

test('un pseudonyme fait de caractères invisibles passe la longueur minimale', () => {
  // breaking_point : « un pseudonyme fait de caractères de largeur nulle ».
  // `trim` ne retire pas U+200B, et `min` les compte comme des caractères.
  const invisible = '\u200b\u200b';
  assert.deepEqual(validate({ ...VALID, display_name: invisible }, SCHEMA), {});
  assert.equal(invisible.trim().length, 2);
});

test('point de rupture : l’essai accepte la boîte qui n’existe pas', () => {
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  const out = essai.run(cas.input, 'fr');
  assert.equal(out.verdict.label, 'Formulaire accepté');
  assert.deepEqual(out.spans, []);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires, risques
// ---------------------------------------------------------------------------

test('une saisie valide passe', () => {
  assert.deepEqual(validate(VALID, SCHEMA), {});
});

test('un champ facultatif peut être absent', () => {
  const { website, ...rest } = VALID;
  assert.deepEqual(validate(rest, SCHEMA), {});
});

test('une erreur par champ fautif, qui nomme le champ', () => {
  const errors = validate({ email: 'ada.example.com', display_name: 'A', age: 12, website: 'nope' }, SCHEMA);
  assert.deepEqual(errors, {
    email: 'is not a valid email address',
    display_name: 'must be at least 2 characters',
    age: 'must be at least 18',
    website: 'is not in the expected format',
  });
});

test('un champ obligatoire absent est nommé', () => {
  assert.deepEqual(validate({}, SCHEMA), { email: 'is required', display_name: 'is required', age: 'is required' });
});

test('clé absente, null et chaîne vide sont la même chose', () => {
  const { email, ...rest } = VALID;
  for (const empty of [{}, { email: null }, { email: undefined }, { email: '' }]) {
    assert.deepEqual(validate({ ...rest, ...empty }, SCHEMA), { email: 'is required' });
  }
});

test('les vérifications s’arrêtent à la première règle enfreinte', () => {
  assert.deepEqual(validate({ ...VALID, age: '12' }, SCHEMA), { age: 'must be of type integer' });
  assert.equal(check('x@', { min: 5, pattern: '[^@\\s]+@[^@\\s]+\\.[a-z]{2,}' }), 'must be at least 5 characters');
});

test('une valeur hors bornes, et les bornes incluses', () => {
  assert.deepEqual(validate({ ...VALID, age: 150 }, SCHEMA), { age: 'must be at most 130' });
  assert.deepEqual(validate({ ...VALID, display_name: 'A'.repeat(31) }, SCHEMA), { display_name: 'must be at most 30 characters' });
  for (const [age, expected] of [[17, { age: 'must be at least 18' }], [18, {}], [130, {}], [131, { age: 'must be at most 130' }]]) {
    assert.deepEqual(validate({ ...VALID, age }, SCHEMA), expected);
  }
  assert.deepEqual(validate({ ...VALID, display_name: 'AB' }, SCHEMA), {});
  assert.deepEqual(validate({ ...VALID, display_name: 'A'.repeat(30) }, SCHEMA), {});
});

test('un décimal, NaN, l’infini et un booléen ne sont pas des entiers', () => {
  // Commentaire : « `Number.isInteger` rejects NaN, Infinity and 1.5 in one go ».
  for (const age of [36.5, Number.NaN, Infinity, true]) {
    assert.deepEqual(validate({ ...VALID, age }, SCHEMA), { age: 'must be of type integer' });
  }
});

test('le motif couvre tout le champ', () => {
  // Commentaire : « Anchored, so a pattern matches the whole field and not a fragment of it ».
  assert.deepEqual(validate({ ...VALID, website: 'see https://example.com' }, SCHEMA), { website: 'is not in the expected format' });
  assert.equal(check('ab', { pattern: 'a|ab' }), null);
});

test('les messages ne contiennent jamais la valeur saisie', () => {
  const secret = 'S3cr3t-Value';
  for (const data of [
    { email: secret, display_name: secret.repeat(5), age: secret, website: secret },
    { email: `${secret}@x`, display_name: secret.slice(0, 1), age: 7, website: `ftp://${secret}` },
  ]) {
    const errors = Object.values(validate(data, SCHEMA));
    assert.ok(errors.length > 0 && errors.every((m) => !m.includes(secret) && !m.includes('7')));
  }
});

test('le schéma est une donnée', () => {
  assert.deepEqual(validate(VALID, JSON.parse(JSON.stringify(SCHEMA))), {});
});

test('n0 est déterministe et n’emploie aucune dépendance', () => {
  const bad = { email: 'x', display_name: '', age: 3 };
  for (let i = 0; i < 20; i += 1) assert.deepEqual(validate(bad, SCHEMA), validate(bad, SCHEMA));
  assert.doesNotMatch(SOURCE, /\bimport\b|\brequire\(/);
});

test('un validateur tient en quarante lignes', () => {
  const lines = SOURCE.split('\n').filter((l) => l.trim() !== '' && !/^\s*(\/\/|\*|\/\*\*)/.test(l));
  assert.ok(lines.length <= 40, String(lines.length));
});

test('une validation prend moins d’une milliseconde', () => {
  let best = Infinity;
  for (let i = 0; i < 50; i += 1) {
    const start = performance.now();
    validate(VALID, SCHEMA);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 1);
});

test('l’essai rend ses trois premiers cas comme il les annonce', () => {
  assert.equal(essai.run(essai.cases[0].input, 'fr').verdict.label, 'Formulaire accepté');
  const four = essai.run(essai.cases[1].input, 'fr');
  assert.equal(four.verdict.label, '4 champs refusés');
  assert.deepEqual(four.rows.rows.map((r) => r[2].v), [
    'is not a valid email address',
    'must be at least 2 characters',
    'must be at least 18',
    'is not in the expected format',
  ]);
  const blank = essai.run(essai.cases[2].input, 'en');
  assert.deepEqual(blank.rows.rows.map((r) => [r[0], r[1], r[2].v ?? r[2]]), [
    ['email', '', 'is required'],
    ['display_name', 'Marie Durand', 'accepted'],
    ['age', 'trente-quatre', 'must be of type integer'],
    ['website', '(not submitted)', 'accepted'],
  ]);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : schéma vide et valeurs d’un autre type', () => {
  // « A field the schema does not declare is refused, not ignored » : un schéma
  // vide ne déclare rien, donc il refuse tout, champ par champ.
  assert.deepEqual(
    validate(VALID, {}),
    Object.fromEntries(Object.keys(VALID).map((field) => [field, 'is not a field of this form'])),
  );
  for (const value of [['ada@example.com'], { a: 1 }, 42, false]) {
    assert.deepEqual(validate({ ...VALID, email: value }, SCHEMA), { email: 'must be of type string' });
  }
  assert.deepEqual(validate({ ...VALID, display_name: [] }, SCHEMA), { display_name: 'must be of type string' });
});

test('production : une saisie énorme termine vite', () => {
  const huge = {
    email: `a@${'a.'.repeat(500_000)}!`,
    display_name: 'x'.repeat(1_000_000),
    age: 1e100,
    // Sans les deux barres obliques : ce n'est pas l'espace de bord qui le
    // refuse, puisqu'elle tombe désormais, c'est le motif.
    website: `https:/${'a'.repeat(1_000_000)} `,
  };
  const start = performance.now();
  const errors = validate(huge, SCHEMA);
  assert.ok(performance.now() - start < 2000);
  assert.deepEqual(Object.keys(errors).sort(), ['age', 'display_name', 'email', 'website']);
});

test('production : encodage, espaces insécables et casse', () => {
  // Un domaine en majuscules est refusé par le motif du test, pas corrigé ;
  // les blancs de bord, eux, tombent.
  assert.deepEqual(validate({ ...VALID, email: ' ada@example.com ' }, SCHEMA), {});
  assert.deepEqual(validate({ ...VALID, email: 'ada@EXAMPLE.COM' }, SCHEMA), { email: 'is not a valid email address' });
  assert.deepEqual(validate({ ...VALID, email: 'ada @example.com' }, SCHEMA), { email: 'is not a valid email address' });
  assert.deepEqual(validate({ ...VALID, display_name: '﻿Ada 🙂' }, SCHEMA), {});
});

test('les bornes comptent des points de code, pas des caractères perçus', () => {
  // Composé (NFC) puis compté en points de code, comme la version Python : « é »
  // compte un quelle que soit sa saisie, un emoji d'un seul point de code compte
  // un, et un drapeau, qui en porte deux, compte deux.
  assert.deepEqual(validate({ ...VALID, display_name: 'é'.repeat(16).normalize('NFD') }, SCHEMA), {});
  assert.deepEqual(validate({ ...VALID, display_name: '🙂' }, SCHEMA), { display_name: 'must be at least 2 characters' });
  assert.deepEqual(validate({ ...VALID, display_name: '🇫🇷' }, SCHEMA), {});
});

test('un raccourci de motif n’a pas le même sens des deux côtés', () => {
  // « the shorthands for a digit and a word character reach beyond ASCII in
  // Python and stop at it in JavaScript, so write [0-9] and [A-Za-z] ». Voici
  // les deux moitiés de cette phrase, mesurées.
  // `\d` refuse ici les chiffres arabes-indiens ; en Python, il les accepte.
  assert.equal(check('١٢٣٤٥', { pattern: '\\d{5}' }), 'is not in the expected format');
  // `[0-9]` les refuse des deux côtés : c'est le conseil de la docstring.
  assert.equal(check('١٢٣٤٥', { pattern: '[0-9]{5}' }), 'is not in the expected format');
  assert.equal(check('12345', { pattern: '[0-9]{5}' }), null);
  // Et le prix de ce conseil : `[A-Za-z]` refuse « Zoé », que `\w` accepte en
  // Python et refuse ici. Pour les lettres, la parité se tient avec `\p{L}`,
  // que `re` ne connaît pas.
  assert.equal(check('Zoé', { pattern: '\\w+' }), 'is not in the expected format');
  assert.equal(check('Zoé', { pattern: '[A-Za-z]+' }), 'is not in the expected format');
});

test('un champ hors schéma passe sans un mot', () => {
  assert.notDeepEqual(validate({ ...VALID, is_admin: true }, SCHEMA), {});
});

test('production : un motif sur un entier convertit l’entier en texte', () => {
  // Python lève TypeError sur le même schéma.
  assert.equal(check(36, { type: 'integer', pattern: '\\d+' }), null);
});
