/**
 * The sample files live here, never in the snippet: the snippet shows a
 * function, not a demonstration.
 *
 * Every file below is built as bytes, because that is what a CSV is before
 * anybody has decided what encoding it is in. The cases are the same as in
 * n0.test.py, and so are the expected values: both versions of this snippet
 * have to return the same rows and the same journal for the same bytes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCsv, decodeText, detectDialect } from './n0.js';

const SCHEMA = {
  id: 'integer',
  name: 'text',
  joined: 'date',
  amount: 'number',
  active: 'boolean',
};

const bytes = (text, encoding = 'utf8') => Buffer.from(text, encoding);

const NOMINAL = bytes(
  'id,name,joined,amount,active\n' +
    '1,Alice,2023-04-12,12.50,yes\n' +
    '2,Bob,01/05/2023,"1 234,56",no\n' +
    '3,Carol,2023-06-30,0.99,true\n',
);

test('reads a well-formed file', () => {
  const result = cleanCsv(NOMINAL, SCHEMA);
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.columns, ['id', 'name', 'joined', 'amount', 'active']);
  assert.deepEqual(result.rows[0], {
    id: 1,
    name: 'Alice',
    joined: '2023-04-12',
    amount: 12.5,
    active: true,
  });
  // A day-first date becomes ISO, and a European decimal comma becomes a
  // number, thousands separator included.
  assert.equal(result.rows[1].joined, '2023-05-01');
  assert.equal(result.rows[1].amount, 1234.56);
});

test('detects a semicolon file whose free text is full of commas', () => {
  const data = bytes(
    'id;name;note\n' +
      '1;Alice;"a, b, c"\n' +
      '2;Bob;"she said ""hello"""\n' +
      '3;Carol;plain\n',
  );
  const result = cleanCsv(data, { id: 'integer' });
  assert.equal(result.delimiter, ';');
  assert.deepEqual(
    result.rows.map((row) => row.note),
    ['a, b, c', 'she said "hello"', 'plain'],
  );
});

test('detects tabs and apostrophe quoting', () => {
  assert.deepEqual(detectDialect('id\tname\n1\tAlice\n'), { delimiter: '\t', quote: '"' });
  assert.deepEqual(detectDialect("id;name\n1;'Al;ice'\n"), { delimiter: ';', quote: "'" });
});

test('normalises the encoding whatever the file arrived in', () => {
  // The same two rows, written three ways a spreadsheet really exports them.
  const expected = [{ city: 'Besançon' }, { city: 'Nîmes' }];
  const plain = 'city\nBesançon\nNîmes\n';
  const utf8Bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes(plain)]);
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), bytes(plain, 'utf16le')]);
  const cp1252 = Buffer.from([...plain].map((c) => c.codePointAt(0))); // latin-1 range
  for (const data of [utf8Bom, utf16, cp1252]) {
    assert.deepEqual(cleanCsv(data, {}).rows, expected);
  }
  // The byte order mark is consumed, not carried into the first column name.
  assert.ok(decodeText(utf8Bom).startsWith('city'));
});

test('handles the files nobody writes a test for', () => {
  const empty = cleanCsv(bytes(''), {});
  assert.deepEqual(empty.rows, []);
  assert.deepEqual(empty.columns, []);
  assert.deepEqual(empty.rejects, []);

  const headerOnly = cleanCsv(bytes('id,name\n'), SCHEMA);
  assert.deepEqual(headerOnly.columns, ['id', 'name']);
  assert.deepEqual(headerOnly.rows, []);

  // One column, blank lines, and no newline at the end of the file.
  const single = cleanCsv(bytes('code\nAB1\n\nCD2'), {});
  assert.deepEqual(
    single.rows.map((row) => row.code),
    ['AB1', 'CD2'],
  );

  // A quoted field may hold the delimiter, a doubled quote, or a newline.
  const quoted = cleanCsv(bytes('id,note\r\n1,"line one\r\nline two"\r\n2,"a,b"\r\n'), {
    id: 'integer',
  });
  assert.deepEqual(
    quoted.rows.map((row) => row.note),
    ['line one\r\nline two', 'a,b'],
  );

  // An empty cell is missing, not malformed, so it is not a rejection.
  const blanks = cleanCsv(bytes('id,joined\n1,\n'), SCHEMA);
  assert.deepEqual(blanks.rows, [{ id: 1, joined: null }]);
  assert.deepEqual(blanks.rejects, []);
});

test('the journal names the line, the column and the reason', () => {
  const data = bytes(
    'id,name,joined,amount,active\n' +
      '1,Alice,31/02/2024,3.5,yes\n' + // a date that does not exist
      '2,Bob,2024-01-09,abc,no\n' + // not a number
      '3,Carol,2024-01-10,1.0,maybe\n' + // not a boolean
      'x,Dan,2024-01-11,1.0,yes\n' + // not an integer
      '5,Eve\n' + // a row shorter than the header
      '6,Frank,2024-01-12,2.0,no\n', // the only survivor
  );
  const result = cleanCsv(data, SCHEMA);

  assert.deepEqual(
    result.rows.map((row) => row.id),
    [6],
  );
  assert.deepEqual(
    result.rejects.map((r) => [r.line, r.column, r.reason]),
    [
      [2, 'joined', 'not a real date'],
      [3, 'amount', 'not a number'],
      [4, 'active', 'not a true or false value'],
      [5, 'id', 'not an integer'],
      [6, '', 'expected 5 fields, found 2'],
    ],
  );
  // The fields are kept as they were read, so a refusal can be acted on
  // without opening the file again. This is what rung N3 is handed.
  assert.deepEqual(result.rejects[0].fields, ['1', 'Alice', '31/02/2024', '3.5', 'yes']);
});

test('breaking point: the separator changes partway through the file', () => {
  // The breaking point claimed on the entry, first half: a file whose
  // separators are not consistent from one line to the next.
  //
  // The dialect is decided once, from the top of the file. Everything written
  // in the other dialect arrives as a single field and is refused. The claim
  // this test defends is not that the cleaner copes, because it does not: it
  // is that the cleaner says so, line by line, instead of quietly returning
  // three rows out of five.
  const data = bytes(
    'id;name;joined\n' +
      '1;Alice;2023-04-12\n' +
      '2;Bob;2023-05-01\n' +
      '# second export appended below\n' +
      'id,name,joined\n' +
      '3,Carol,2024-01-09\n' +
      '4;Dan;2024-02-11\n',
  );
  const result = cleanCsv(data, SCHEMA);

  assert.equal(result.delimiter, ';');
  assert.deepEqual(
    result.rows.map((row) => row.id),
    [1, 2, 4],
  );
  assert.deepEqual(
    result.rejects.map((r) => [r.line, r.reason]),
    [
      [4, 'expected 3 fields, found 1'],
      [5, 'expected 3 fields, found 1'],
      [6, 'expected 3 fields, found 1'],
    ],
  );
});

test('breaking point: a column changes meaning partway through the file', () => {
  // The breaking point claimed on the entry, second half, and the worse one:
  // a column whose meaning changes without its shape changing.
  //
  // Here the export switches from day-first to month-first halfway down.
  // Every row still has the right number of fields and every value still
  // coerces, so the journal is empty and the file looks clean. It is not: the
  // fourth of July has become the seventh of April.
  //
  // Nothing in this rung can see that, and nothing in the next two can either
  // without being told what the file means. A type checker checks types. Only
  // a date whose day happens to exceed twelve gets caught, and that is luck,
  // not detection.
  const data = bytes(
    'id,joined\n' +
      '1,07/04/2023\n' + // written day-first: the seventh of April
      '2,07/04/2023\n' + // written month-first: the fourth of July
      '3,12/25/2023\n', // written month-first: Christmas
  );
  const result = cleanCsv(data, SCHEMA);

  // Two different days, silently read as the same one, with nothing said.
  assert.deepEqual(
    result.rows.map((row) => row.joined),
    ['2023-04-07', '2023-04-07'],
  );
  // Caught only because no month has twenty-five days.
  assert.deepEqual(
    result.rejects.map((r) => [r.line, r.column, r.reason]),
    [[4, 'joined', 'not a real date']],
  );
});
