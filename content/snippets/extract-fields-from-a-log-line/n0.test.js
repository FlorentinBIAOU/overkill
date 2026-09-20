import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOOSE, PATTERNS, PIECES, compilePattern, loosePieces, parseLines,
} from './n0.js';

const APACHE = [
  '192.168.0.12 - jean [10/Oct/2026:13:55:36 +0200] "GET /factures/42 HTTP/1.1"'
  + ' 200 2326 "https://exemple.fr/" "Mozilla/5.0 (X11; Linux x86_64)"',
  '203.0.113.7 - - [10/Oct/2026:13:55:37 +0200] "POST /connexion HTTP/1.1"'
  + ' 302 - "-" "curl/8.5.0"',
  '2001:db8::1 - marie [10/Oct/2026:13:55:38 +0200] "GET /café HTTP/1.1"'
  + ' 404 512 "-" "Mozilla/5.0"',
];

const SYSLOG = '<34>Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for jean from 203.0.113.7';

// Le même motif, avec l'horodatage décrit par un morceau trop lâche.
// Ce que contient vraiment /var/log/syslog, /var/log/auth.log ou la sortie de
// journalctl : le collecteur retire la priorité entre chevrons avant d'écrire.
const SYSLOG_FICHIER = [
  'Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for root',
  'Oct 10 13:55:36 serveur1 systemd[1]: Started Session 3 of user jean.',
  'Oct 10 13:55:37 serveur1 CRON[4521]: pam_unix(cron:session): session opened',
];

// Une ligne d'accès dont la requête porte un guillemet échappé, ce qu'écrit
// mod_log_config et ce que produisent les scanners tous les jours.
const APACHE_GUILLEMET = '203.0.113.9 - - [10/Oct/2026:13:55:39 +0200] "GET /a\\"b HTTP/1.1"'
  + ' 404 512 "-" "curl/8.5.0"';

// Le même motif, avec l'horodatage ET l'étiquette décrits par un morceau trop
// lâche. Les deux sont relâchés : c'est ce que le point de rupture publie.
const LACHE = '<%{INT:priority}>%{DATA:timestamp} %{WORD:host} %{DATA:tag}: %{GREEDY:message}';

// Une trace d'exception : une ligne qui correspond, et trois qui ne
// correspondent pas mais qui portent l'information.
const TRACE = [
  '<27>Oct 10 13:55:40 serveur1 app[42]: Traceback (most recent call last):',
  '  File "/srv/app/facture.py", line 118, in enregistrer',
  '    total = ligne.montant_ht + ligne.tva',
  "AttributeError: 'NoneType' object has no attribute 'montant_ht'",
];

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : un motif trop lâche découpe faux sans rien signaler", () => {
  // « Le motif qui décrit l'horodatage et l'étiquette par « %{DATA} » rend
  // timestamp « Oct », host « 10 » et tag « 13:55:36 serveur1 sshd[1234] »,
  // et la ligne n'est pas rejetée. » Les deux morceaux sont relâchés : ne
  // relâcher que l'horodatage donne un autre découpage, tout aussi faux.
  assert.equal(LACHE.split('%{DATA:').length - 1, 2);
  const rapport = parseLines([SYSLOG], LACHE);
  assert.deepEqual(rapport.rejected, []);
  const champ = rapport.parsed[0];
  assert.equal(champ.timestamp, 'Oct');
  assert.equal(champ.host, '10');
  assert.equal(champ.tag, '13:55:36 serveur1 sshd[1234]');
  assert.deepEqual(rapport.loose_pieces, ['timestamp', 'tag']);
  const unSeul = '<%{INT:priority}>%{DATA:timestamp} %{WORD:host} %{NOTCOLON:tag}: %{GREEDY:message}';
  const autre = parseLines([SYSLOG], unSeul).parsed[0];
  assert.deepEqual([autre.timestamp, autre.host, autre.tag],
    ['Oct 10', '13:55:36', 'serveur1 sshd[1234]']);
});

test('point de rupture : témoin, le motif de la fiche rend les quatre champs justes', () => {
  const champ = parseLines([SYSLOG], 'syslog-3164').parsed[0];
  assert.equal(champ.timestamp, 'Oct 10 13:55:36');
  assert.equal(champ.host, 'serveur1');
  assert.equal(champ.tag, 'sshd[1234]');
  assert.equal(champ.message, 'Failed password for jean from 203.0.113.7');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("le motif syslog lit les lignes d'un fichier de journal", () => {
  // Commentaire : « The syslog priority between angle brackets exists on the
  // wire […] and the collector strips it before writing. » R1 : l'entrée
  // ordinaire du lecteur est une ligne de /var/log/syslog, pas un paquet UDP.
  const rapport = parseLines(SYSLOG_FICHIER, 'syslog-3164');
  assert.deepEqual(rapport.rejected, []);
  assert.deepEqual(rapport.parsed.map((c) => c.host), ['serveur1', 'serveur1', 'serveur1']);
  assert.deepEqual(rapport.parsed.map((c) => c.tag),
    ['sshd[1234]', 'systemd[1]', 'CRON[4521]']);
  assert.deepEqual(rapport.parsed.map((c) => c.priority), [null, null, null]);
  assert.equal(parseLines([SYSLOG], 'syslog-3164').parsed[0].priority, '34');
});

test("une requête avec un guillemet échappé n'est pas rejetée", () => {
  // Commentaire du morceau `QUOTED` : « `mod_log_config` writes a `\"` inside
  // the request and the agent, and scanners produce them every day. »
  const rapport = parseLines([APACHE_GUILLEMET], 'apache-combined');
  assert.deepEqual(rapport.rejected, []);
  assert.equal(rapport.parsed[0].request, 'GET /a\\"b HTTP/1.1');
  assert.equal(rapport.parsed[0].status, '404');
  assert.deepEqual(parseLines([APACHE[1]], 'apache-combined').rejected, []);
});

test('les morceaux lâches hors de la dernière position sont nommés', () => {
  // Docstring : « `loose_pieces` names the pieces that can cut anywhere.
  // Nothing is rejected because of them — that is exactly the problem. »
  assert.deepEqual(LOOSE, ['DATA', 'GREEDY']);
  assert.deepEqual(loosePieces('%{DATA:a} %{WORD:b} %{GREEDY:c}'), ['a']);
  for (const nom of ['syslog-3164', 'nginx-error', 'apache-combined']) {
    assert.deepEqual(loosePieces(PATTERNS[nom]), [], nom);
  }
});

test('une ligne qui ne correspond pas est rendue, jamais perdue', () => {
  const rapport = parseLines([...APACHE, 'pas une ligne de journal'], 'apache-combined');
  assert.equal(rapport.parsed.length, 3);
  assert.deepEqual(rapport.rejected, [{ line: 4, text: 'pas une ligne de journal' }]);
  const melange = parseLines(['x', APACHE[0], 'y'], 'apache-combined');
  assert.deepEqual(melange.rejected.map((r) => r.line), [1, 3]);
  assert.deepEqual(melange.parsed.map((p) => p.line), [2]);
});

test("l'horodatage est rendu tel qu'il est écrit", () => {
  const champ = parseLines([SYSLOG], 'syslog-3164').parsed[0];
  assert.equal(champ.timestamp, 'Oct 10 13:55:36');
  assert.ok(!champ.timestamp.includes('2026'));
  assert.ok(!champ.timestamp.includes('+'));
  assert.equal(
    parseLines(APACHE, 'apache-combined').parsed[0].timestamp,
    '10/Oct/2026:13:55:36 +0200',
  );
});

test('la notation nommée est compilée dans la syntaxe du langage', () => {
  const expression = compilePattern('%{INT:status} %{WORD:size}');
  assert.ok(expression.source.includes('(?<status>'));
  assert.deepEqual(
    { ...expression.exec('200 2326').groups },
    { status: '200', size: '2326' },
  );
  assert.equal(parseLines(['x'], '%{INCONNU:champ}').reason, 'this pattern is not usable');
  assert.equal(parseLines(['x'], '(').reason, 'this pattern is not usable');
});

test('les trois formats livrés lisent leurs lignes', () => {
  for (const [nom, ligne] of [
    ['apache-combined', APACHE[0]],
    ['syslog-3164', SYSLOG],
    ['nginx-error', '2026/10/10 13:55:36 [error] 1234#0: *5 open() failed'],
  ]) {
    const rapport = parseLines([ligne], nom);
    assert.deepEqual(rapport.rejected, [], nom);
    assert.equal(rapport.parsed[0].line, 1, nom);
  }
  assert.deepEqual(
    new Set(Object.keys(PATTERNS)),
    new Set(['apache-combined', 'syslog-3164', 'nginx-error']),
  );
});

test("un motif peut être écrit par l'appelant", () => {
  const rapport = parseLines(['utilisateur=jean action=connexion duree=42'],
    'utilisateur=%{WORD:user} action=%{WORD:action} duree=%{INT:ms}');
  assert.deepEqual(rapport.parsed[0], { line: 1, user: 'jean', action: 'connexion', ms: '42' });
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, trois lignes d'un journal d'accès", () => {
  const rapport = parseLines(APACHE, 'apache-combined');
  assert.deepEqual(rapport.rejected, []);
  assert.deepEqual(rapport.parsed.map((p) => p.status), ['200', '302', '404']);
  assert.equal(rapport.parsed[2].client, '2001:db8::1');
  assert.equal(rapport.parsed[1].size, '-');
});

test('production : entrée vide', () => {
  assert.deepEqual(parseLines([], 'apache-combined'),
    { parsed: [], rejected: [], loose_pieces: [], reason: null });
  assert.deepEqual(parseLines([''], 'apache-combined').rejected, [{ line: 1, text: '' }]);
});

test('production : entrée très grande et terminaison rapide', () => {
  const lignes = Array.from({ length: 33_334 }, () => APACHE).flat();
  let debut = performance.now();
  const rapport = parseLines(lignes, 'apache-combined');
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.parsed.length, 100_002);
  debut = performance.now();
  parseLines([`1.2.3.4 - - [${'a'.repeat(100_000)}`], 'apache-combined');
  assert.ok(performance.now() - debut < 10_000);
});

test('production : encodages inattendus', () => {
  const rapport = parseLines(APACHE, 'apache-combined');
  assert.equal(rapport.parsed[2].request, 'GET /café HTTP/1.1');
  assert.equal(rapport.parsed[0].agent, 'Mozilla/5.0 (X11; Linux x86_64)');
  assert.ok(parseLines([`${SYSLOG}\r\n`], 'syslog-3164').parsed[0].message.endsWith('203.0.113.7'));
  assert.deepEqual(parseLines([null, 42], 'apache-combined').rejected,
    [{ line: 1, text: null }, { line: 2, text: null }]);
});

test('production : valeurs aux limites', () => {
  const tronquee = APACHE[0].slice(0, APACHE[0].lastIndexOf(' "'));
  const rapport = parseLines(['', 'x', tronquee], 'apache-combined');
  assert.equal(rapport.rejected.length, 3);
  assert.deepEqual(new Set(Object.keys(PIECES)), new Set(['IP', 'WORD', 'INT', 'DATA',
    'QUOTED', 'BRACKETED', 'NOTCOLON', 'SYSLOGDATE', 'GREEDY']));
});

test("production : une trace d'exception donne une ligne et des rejets", () => {
  const rapport = parseLines(TRACE, 'syslog-3164');
  assert.equal(rapport.parsed.length, 1);
  assert.equal(rapport.rejected.length, 3);
  assert.ok(rapport.rejected[2].text.includes('AttributeError'));
});

test('production : le découpage tient la classe de latence annoncée', () => {
  const debut = performance.now();
  parseLines(Array.from({ length: 33_334 }, () => APACHE).flat(), 'apache-combined');
  assert.ok(performance.now() - debut < 60_000);
});
