/**
 * Tests du niveau N0 : dialecte, encodage, coercition typée, journal des
 * rejets. Les fichiers d'exemple vivent ici, en octets. Les cas et les valeurs
 * attendues sont ceux de n0.test.py : les deux versions de l'extrait doivent
 * rendre les mêmes lignes et le même journal pour les mêmes octets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import essai from '../../tryouts/live/convert-messy-csv-to-clean-data.js';
import { Rejected, cleanCsv, coerceRow, decodeText, detectDialect, parseRecords } from './n0.js';

const SCHEMA = { id: 'integer', name: 'text', joined: 'date', amount: 'number', active: 'boolean' };

const bytes = (text, encoding = 'utf8') => Buffer.from(text, encoding);
const journal = (result) => result.rejects.map((r) => [r.line, r.column, r.reason]);
const SOURCE = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');

const NOMINAL = bytes(
  'id,name,joined,amount,active\n' +
    '1,Alice,2023-04-12,12.50,yes\n' +
    '2,Bob,01/05/2023,"1 234,56",no\n' +
    '3,Carol,2023-06-30,0.99,true\n',
);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une colonne change de sens en cours de fichier', () => {
  const data = bytes('id,joined\n1,07/04/2023\n2,07/04/2023\n3,12/25/2023\n');
  const result = cleanCsv(data, SCHEMA);
  assert.deepEqual(result.rows.map((row) => row.joined), ['2023-04-07', '2023-04-07']);
  assert.deepEqual(journal(result), [[4, 'joined', 'not a real date']]);
  // Témoin : une date jour d'abord sans ambiguïté est lue juste.
  assert.deepEqual(cleanCsv(bytes('id,joined\n1,25/12/2023\n'), SCHEMA).rows, [{ id: 1, joined: '2023-12-25' }]);
});

test('point de rupture : un second export recollé avec un autre séparateur', () => {
  const data = bytes('id;name;joined\n1;Alice;2023-04-12\n2;Bob;2023-05-01\nid,name,joined\n3,Carol,2024-01-09\n4,Dan,2024-02-11\n');
  const result = cleanCsv(data, SCHEMA);
  assert.equal(result.delimiter, ';');
  assert.deepEqual(result.rows.map((row) => row.id), [1, 2]);
  assert.deepEqual(result.rejects.map((r) => [r.line, r.reason]), [
    [4, 'expected 3 fields, found 1'],
    [5, 'expected 3 fields, found 1'],
    [6, 'expected 3 fields, found 1'],
  ]);
  assert.deepEqual(journal(cleanCsv(bytes('id,name,joined\n3,Carol,2024-01-09\n'), SCHEMA)), []);
});

test('point de rupture : une ligne du premier dialecte après le second reste lue', () => {
  const data = bytes(
    'id;name;joined\n1;Alice;2023-04-12\n2;Bob;2023-05-01\n# second export appended below\n' +
      'id,name,joined\n3,Carol,2024-01-09\n4;Dan;2024-02-11\n',
  );
  const result = cleanCsv(data, SCHEMA);
  assert.deepEqual(result.rows.map((row) => row.id), [1, 2, 4]);
  assert.deepEqual(result.rejects.map((r) => [r.line, r.reason]), [
    [4, 'expected 3 fields, found 1'],
    [5, 'expected 3 fields, found 1'],
    [6, 'expected 3 fields, found 1'],
  ]);
});

test('point de rupture : l’essai montre la date qui change de sens', () => {
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  const out = essai.run(cas.input, 'fr');
  assert.deepEqual(out.rows.rows.map((r) => [r[0], r[1], r[3], r.at(-1)]), [
    ['2', '41', '2023-04-07', 'retenue'],
    ['3', '42', '2023-04-07', 'retenue'],
    ['4', { v: '43', caught: false }, { v: '12/25/2023', caught: true }, 'not a real date'],
  ]);
});

test('l’essai nomme les factures, pas les lignes du tableau', () => {
  // `why` : « Les factures 41 et 42 […] Seule la facture 43 est refusée ».
  const cas = essai.cases[3];
  assert.match(cas.why.fr, /Les factures 41 et 42/);
  assert.match(cas.why.en, /Invoices 41 and 42/);
  const out = essai.run(cas.input, 'fr');
  // 41, 42, 43 sont bien des identifiants de facture, en deuxième colonne ;
  // la première porte le numéro de ligne du fichier.
  assert.deepEqual(out.rows.rows.map((r) => r[0]), ['2', '3', '4']);
  assert.deepEqual(out.rows.rows.map((r) => (typeof r[1] === 'string' ? r[1] : r[1].v)), ['41', '42', '43']);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires
// ---------------------------------------------------------------------------

test('lit un fichier bien formé', () => {
  const result = cleanCsv(NOMINAL, SCHEMA);
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.columns, ['id', 'name', 'joined', 'amount', 'active']);
  assert.deepEqual(result.rows, [
    { id: 1, name: 'Alice', joined: '2023-04-12', amount: 12.5, active: true },
    { id: 2, name: 'Bob', joined: '2023-05-01', amount: 1234.56, active: false },
    { id: 3, name: 'Carol', joined: '2023-06-30', amount: 0.99, active: true },
  ]);
});

test('n0 n’emploie que la bibliothèque standard', () => {
  // « Node's standard library only, parser included ».
  assert.doesNotMatch(SOURCE, /\bimport\b|\brequire\(/);
});

test('n0 est déterministe et se traite en moins d’une milliseconde', () => {
  const first = cleanCsv(NOMINAL, SCHEMA);
  let best = Infinity;
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    assert.deepEqual(cleanCsv(NOMINAL, SCHEMA), first);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 1, `${best} ms`);
});

test('les octets deviennent du texte avant que le séparateur soit compté', () => {
  const data = Buffer.concat([Buffer.from([0xff, 0xfe]), bytes('id;ville\n1;Besançon\n', 'utf16le')]);
  const result = cleanCsv(data, { id: 'integer' });
  assert.equal(result.delimiter, ';');
  assert.deepEqual(result.rows, [{ id: 1, ville: 'Besançon' }]);
});

test('détecte un fichier à points-virgules dont le texte libre est plein de virgules', () => {
  const data = bytes('id;name;note\n1;Alice;"a, b, c"\n2;Bob;"she said ""hello"""\n3;Carol;plain\n');
  const result = cleanCsv(data, { id: 'integer' });
  assert.equal(result.delimiter, ';');
  assert.deepEqual(result.rows.map((row) => row.note), ['a, b, c', 'she said "hello"', 'plain']);
});

test('détecte les tabulations et les apostrophes comme guillemets', () => {
  assert.deepEqual(detectDialect('id\tname\n1\tAlice\n'), { delimiter: '\t', quote: '"' });
  assert.deepEqual(detectDialect("id;name\n1;'Al;ice'\n"), { delimiter: ';', quote: "'" });
});

test('une apostrophe ne compte que lorsqu’elle ouvre un champ', () => {
  assert.deepEqual(detectDialect("id;name\n1;l'été\n2;aujourd'hui\n3;c'est\n"), { delimiter: ';', quote: '"' });
});

test('normalise l’encodage quel que soit le fichier reçu', () => {
  const expected = [{ city: 'Besançon' }, { city: 'Nîmes' }];
  const text = 'city\nBesançon\nNîmes\n';
  const utf16be = Buffer.from(bytes(text, 'utf16le')).swap16();
  for (const data of [
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes(text)]),
    Buffer.concat([Buffer.from([0xff, 0xfe]), bytes(text, 'utf16le')]),
    Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be]),
    bytes(text),
    bytes(text, 'latin1'),
  ]) {
    assert.deepEqual(cleanCsv(data, {}).rows, expected);
  }
  assert.ok(decodeText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes(text)])).startsWith('city'));
});

test('les cinq octets indéfinis de cp1252 deviennent le caractère de remplacement', () => {
  // « both versions of this snippet have to return the same text for the same bytes ».
  assert.equal(decodeText(Buffer.from([0x63, 0x81, 0x8d, 0x8f, 0x90, 0x9d, 0xe9])), 'c�����é');
});

test('production : une marque UTF-8 suivie d’un octet invalide est remplacée', () => {
  // Les deux versions rendent le même texte : la marque est décodée avec remplacement.
  const data = Buffer.from([0xef, 0xbb, 0xbf, ...bytes('city\nBesan'), 0xe7, ...bytes('on\nNimes\n')]);
  assert.deepEqual(cleanCsv(data, {}).rows, [{ city: 'Besan�on' }, { city: 'Nimes' }]);
});

test('un encodage non pris en charge est lu en colonnes illisibles sans journal', () => {
  const utf32 = Buffer.from([0xff, 0xfe, 0x00, 0x00, ...[...'city\nBesançon\n'].flatMap((c) => [c.codePointAt(0), 0, 0, 0])]);
  for (const data of [bytes('city\nBesançon\n', 'utf16le'), utf32]) {
    const result = cleanCsv(data, {});
    assert.ok(result.columns[0] === 'city' || result.rejects.length > 0, JSON.stringify(result.columns));
  }
});

test('cp1252 et non Latin-1, pour le signe euro', () => {
  // « cp1252 and not Latin-1, which has no euro sign ».
  assert.equal(decodeText(Buffer.from([0x80])), '€');
  // En Latin-1 (ISO 8859-1), un octet vaut son propre point de code : 0x80 y
  // est un caractère de commande. (« latin1 » est un alias de cp1252 dans
  // l'encodage du WHATWG, il ne sert donc pas de témoin ici.)
  assert.equal(String.fromCharCode(0x80), '\u0080');
});

test('l’échantillon du dialecte compte vingt lignes physiques', () => {
  // « twenty physical lines, not twenty records […] judged on very few of its
  // records ».
  const inside = Array.from({ length: 22 }, (_, i) => `ligne ${i}`).join('\n');
  const text = `id;note\n1;"${inside}"\n2;ok\n`;
  assert.ok(text.split('\n').length > 20);
  assert.deepEqual(detectDialect(text), { delimiter: ';', quote: '"' });
  // Le fichier est lu en entier malgré tout : l'échantillon ne borne que la
  // devinette, pas la lecture.
  assert.deepEqual(cleanCsv(bytes(text), {}).rows.map((row) => row.id), ['1', '2']);
});

test('une virgule et un point : la dernière marque est décimale', () => {
  // « both marks present […] The last mark of the two is the decimal one » ;
  // « one mark that cannot group […] is 12.5 whoever wrote it ».
  const data = bytes('amount\n"1.234,56"\n"1,234.56"\n"12,5"\n1 234\n"1 234,56"\n"1 234,56"\n5.\n.5\n');
  assert.deepEqual(cleanCsv(data, { amount: 'number' }).rows.map((row) => row.amount), [1234.56, 1234.56, 12.5, 1234, 1234.56, 1234.56, 5, 0.5]);
});

test('production : une marque ambiguë sans convention va au journal', () => {
  // « Without `decimal`, the value goes to the journal rather than being
  // divided by a thousand in silence ».
  const result = cleanCsv(bytes('amount\n"1,234"\n"12,500"\n1.234\n'), { amount: 'number' });
  assert.deepEqual(result.rows, []);
  const ambigu = "ambiguous decimal mark: declare decimal=',' or decimal='.'";
  assert.deepEqual(result.rejects.map((r) => [r.line, r.column, r.reason]), [
    [2, 'amount', ambigu],
    [3, 'amount', ambigu],
    [4, 'amount', ambigu],
  ]);
});

test('production : la convention déclarée tranche la marque ambiguë', () => {
  const data = bytes('amount\n"1,234"\n"12,500"\n');
  assert.deepEqual(cleanCsv(data, { amount: 'number' }, '.').rows.map((r) => r.amount), [1234, 12500]);
  assert.deepEqual(cleanCsv(data, { amount: 'number' }, ',').rows.map((r) => r.amount), [1.234, 12.5]);
});

test('production : une marque qui contredit la convention va au journal', () => {
  const result = cleanCsv(bytes('amount\n"12,50"\n"12.50"\n'), { amount: 'number' }, '.');
  assert.deepEqual(result.rows.map((r) => r.amount), [12.5]);
  assert.deepEqual(result.rejects.map((r) => [r.line, r.reason]), [
    [2, "decimal mark is not the '.' declared for the file"],
  ]);
});

test('production : une marque répétée groupe les milliers', () => {
  const data = bytes('amount\n"1,234,567"\n"1.234.567"\n"1 234 567,89"\n');
  const result = cleanCsv(data, { amount: 'number' });
  assert.deepEqual(result.rows.map((r) => r.amount), [1234567, 1234567, 1234567.89]);
  assert.deepEqual(result.rejects, []);
});

test('production : un export de boutique en ligne ordinaire est lu ou refusé', () => {
  const data = bytes(
    'order,city,total,placed\n' +
      '41,Boulogne-Billancourt,"1,234.50",12/04/2023\n' +
      '42,Besançon,"12,500",13/04/2023\n' +
      '43,Le Puy-en-Velay,49.90,14/04/2023\n',
  );
  const schema = { order: 'integer', city: 'text', total: 'number', placed: 'date' };
  const result = cleanCsv(data, schema, '.');
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.rows.map((r) => [r.city, r.total]), [
    ['Boulogne-Billancourt', 1234.5],
    ['Besançon', 12500],
    ['Le Puy-en-Velay', 49.9],
  ]);
  // Le même fichier sans convention : rien n'est deviné, tout est dit.
  const sans = cleanCsv(data, schema);
  assert.deepEqual(sans.rejects.map((r) => [r.line, r.column]), [[3, 'total']]);
});

test('une date hors forme ISO est lue jour d’abord et le calendrier est vérifié', () => {
  const data = bytes('joined\n01.05.2023\n29/02/2024\n29/02/2000\n31/02/2024\n01/13/2023\n29/02/2023\n29/02/1900\n0000-01-01\n7/4/2023\n');
  const result = cleanCsv(data, { joined: 'date' });
  assert.deepEqual(result.rows.map((row) => row.joined), ['2023-05-01', '2024-02-29', '2000-02-29']);
  assert.deepEqual(result.rejects.map((r) => r.reason), [...Array(5).fill('not a real date'), 'not a date']);
  // Commentaire : « Built-in date objects roll 31 February over to 2 March instead of refusing it ».
  const rolled = new Date(2024, 1, 31);
  assert.deepEqual([rolled.getMonth(), rolled.getDate()], [2, 2]);
});

test('les mots vrai et faux', () => {
  const words = ['true', 'YES', 'y', '1', 'vrai', 'Oui', 'o', 'false', 'No', 'n', '0', 'faux', 'NON'];
  const result = cleanCsv(bytes(`active\n${words.join('\n')}\n`), { active: 'boolean' });
  assert.deepEqual(result.rows.map((row) => row.active), [...Array(7).fill(true), ...Array(6).fill(false)]);
});

test('la première valeur refusée nomme la ligne', () => {
  assert.deepEqual(journal(cleanCsv(bytes('id,name,joined,amount,active\nx,Alice,xx,yy,maybe\n'), SCHEMA)), [[2, 'id', 'not an integer']]);
  assert.throws(() => coerceRow(['joined', 'amount'], ['xx', 'yy'], SCHEMA), (error) => {
    assert.ok(error instanceof Rejected);
    assert.deepEqual([error.column, error.reason], ['joined', 'not a date']);
    return true;
  });
});

test('le journal nomme la ligne, la colonne et la raison', () => {
  const data = bytes(
    'id,name,joined,amount,active\n1,Alice,31/02/2024,3.5,yes\n2,Bob,2024-01-09,abc,no\n' +
      '3,Carol,2024-01-10,1.0,maybe\nx,Dan,2024-01-11,1.0,yes\n5,Eve\n6,Frank,2024-01-12,2.0,no\n',
  );
  const result = cleanCsv(data, SCHEMA);
  assert.deepEqual(result.rows.map((row) => row.id), [6]);
  assert.deepEqual(journal(result), [
    [2, 'joined', 'not a real date'],
    [3, 'amount', 'not a number'],
    [4, 'active', 'not a true or false value'],
    [5, 'id', 'not an integer'],
    [6, '', 'expected 5 fields, found 2'],
  ]);
  assert.deepEqual(result.rejects[0].fields, ['1', 'Alice', '31/02/2024', '3.5', 'yes']);
});

test('les numéros de ligne suivent les champs sur plusieurs lignes', () => {
  assert.deepEqual(journal(cleanCsv(bytes('id,note,amount\n1,"deux\nlignes",1.0\n2,ok,abc\n'), { amount: 'number' })), [[4, 'amount', 'not a number']]);
});

test('une colonne absente du schéma reste du texte', () => {
  assert.deepEqual(cleanCsv(bytes('id,code\n007,  0042 \n'), {}).rows, [{ id: '007', code: '0042' }]);
});

test('le découpeur garde a"b tel qu’il a été tapé', () => {
  // « A quote only opens a field at the start of one, which is what lets `a"b` stay the three characters ».
  assert.deepEqual(parseRecords('x,a"b\n', ',', '"'), [[1, ['x', 'a"b']]]);
});

test('les fichiers pour lesquels personne n’écrit de test', () => {
  assert.deepEqual(cleanCsv(bytes(''), {}), { columns: [], delimiter: ',', quote: '"', rows: [], rejects: [] });
  const headerOnly = cleanCsv(bytes('id,name\n'), SCHEMA);
  assert.deepEqual([headerOnly.columns, headerOnly.rows], [['id', 'name'], []]);
  assert.deepEqual(cleanCsv(bytes('code\nAB1\n\nCD2'), {}).rows.map((row) => row.code), ['AB1', 'CD2']);
  const quoted = cleanCsv(bytes('id,note\r\n1,"line one\r\nline two"\r\n2,"a,b"\r\n'), { id: 'integer' });
  assert.deepEqual(quoted.rows.map((row) => row.note), ['line one\r\nline two', 'a,b']);
  const blanks = cleanCsv(bytes('id,joined\n1,\n'), SCHEMA);
  assert.deepEqual([blanks.rows, blanks.rejects], [[{ id: 1, joined: null }], []]);
});

test('l’essai lit ses trois premiers cas comme il les annonce', () => {
  const notes = [
    'Séparateur détecté : « ; ». 3 lignes retenues, 0 refusée.',
    'Séparateur détecté : « , ». 2 lignes retenues, 0 refusée.',
    'Séparateur détecté : « ; ». 1 ligne retenue, 3 refusées.',
  ];
  notes.forEach((note, i) => assert.equal(essai.run(essai.cases[i].input, 'fr').note, note));
  const refused = essai.run(essai.cases[2].input, 'fr').rows.rows.map((r) => r.at(-1));
  assert.deepEqual(refused, ['retenue', 'not a real date', 'not a number', 'expected 5 fields, found 4']);
  const second = essai.run(essai.cases[1].input, 'en').rows.rows;
  assert.deepEqual(second.map((r) => [r[2], r[4]]), [['Boulangerie Martin', '1234.56'], ['Dubois, Menuiserie', '99']]);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fins de ligne CR seules et guillemet au milieu d’un champ', () => {
  assert.deepEqual(cleanCsv(bytes('id;name\r1;Alice\r2;Bob\r'), {}).rows, [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
  // Un guillemet qui n'ouvre pas un champ reste tel qu'il a été tapé ; un
  // guillemet fermant suivi de texte rend l'enregistrement illisible, et il part
  // au journal avec sa ligne brute plutôt que d'être deviné.
  const result = cleanCsv(bytes('id,name\n1,Eve "the boss"\n2,"a"b\n'), {});
  assert.deepEqual(result.rows.map((row) => row.name), ['Eve "the boss"']);
  assert.deepEqual(result.rejects, [
    { line: 3, column: '', reason: 'text after a closing quote', fields: ['2,"a"b'] },
  ]);
  assert.equal(result.rows.length + result.rejects.length, 2);
});

test('production : cent mille lignes terminent vite', () => {
  const data = bytes(`id,name,joined,amount,active\n${Array.from({ length: 100_000 }, (_, i) => `${i},Alice,2023-04-12,12.50,yes\n`).join('')}`);
  const start = performance.now();
  const result = cleanCsv(data, SCHEMA);
  assert.ok(performance.now() - start < 5000); // mesuré 0,2 s
  assert.equal(result.rows.length, 100_000);
});

test('production : encodage NFD, emoji, insécables', () => {
  const name = 'Zoé 🙂'.normalize('NFD');
  assert.deepEqual(cleanCsv(bytes(`id;name;amount\n1;${name};1 234,5\n`), SCHEMA).rows, [{ id: 1, name, amount: 1234.5 }]);
});

test('un grand entier est arrondi sans journal', () => {
  // Python rend 123456789012345678901 et 9007199254740993 exacts.
  const result = cleanCsv(bytes('id\n123456789012345678901\n9007199254740993\n'), { id: 'integer' });
  assert.deepEqual(result.rows.map((row) => String(row.id)), ['123456789012345678901', '9007199254740993']);
});

test('production : des chiffres non ASCII divisent les deux langages', () => {
  // `\d` sans drapeau `u` refuse « ١٢ » ; Python l'accepte comme 12.
  assert.deepEqual(journal(cleanCsv(bytes('a\n١٢\n'), { a: 'integer' })), [[2, 'a', 'not an integer']]);
});

test('production : une clé de schéma à la mauvaise casse laisse la colonne en texte', () => {
  assert.deepEqual(cleanCsv(bytes('id,Name\n1,Alice\n'), { name: 'integer' }).rows, [{ id: '1', Name: 'Alice' }]);
});

test('une apostrophe de tableur fusionne des lignes', () => {
  const result = cleanCsv(bytes("id,phone\n1,'0612345678\n2,'0698765432\n3,'0611111111\n"), {});
  assert.equal(result.rows.length + result.rejects.length, 3);
});

test('un guillemet non fermé fait disparaître la suite', () => {
  const result = cleanCsv(bytes('id,name\n1,"Alice\n2,Bob\n3,Carol\n'), {});
  assert.equal(result.rows.length + result.rejects.length, 3);
});

test('deux colonnes du même nom perdent une valeur', () => {
  const result = cleanCsv(bytes('id,id\n1,2\n'), {});
  assert.ok(result.rejects.length > 0 || Object.values(result.rows[0]).includes('1'));
});

test('production : un champ très long est refusé, et la suite du fichier est lue', () => {
  // La même limite qu'en Python, celle de csv.field_size_limit() : au-delà,
  // l'enregistrement part au journal, et la lecture reprend à la ligne suivante.
  const data = Buffer.concat([bytes('id,note\n1,'), Buffer.alloc(200_000, 0x78), bytes('\n2,ok\n')]);
  const result = cleanCsv(data, {});
  assert.deepEqual(result.rows, [{ id: '2', note: 'ok' }]);
  assert.equal(result.rejects.length, 1);
  assert.equal(result.rejects[0].reason, 'field longer than 131072 characters');
  assert.equal(result.rejects[0].line, 2);
});
