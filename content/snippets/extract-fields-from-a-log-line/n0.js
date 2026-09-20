/**
 * Cut a log line into fields with a named pattern.
 *
 * Rung N0. A log line is not free text: it was written by a program, with a
 * format fixed by that program, and often by a standard. There is nothing to
 * infer — the shape is known before the first line arrives, which is exactly
 * the situation a regular expression was invented for.
 *
 * What makes the difference at volume is not the expression but the vocabulary
 * around it. Grok, the notation Logstash made common, names the pieces once —
 * `%{IP:client}`, `%{INT:status}` — and lets a line be described by its fields
 * rather than by a wall of brackets. The dozen lines below are that idea, with
 * the pieces this entry needs; the real libraries ship a few hundred of them.
 *
 * Two rules the rest of this file exists for. A line that does not match is
 * never dropped: it comes back in `rejected`, with its number, because a log
 * parser that quietly loses one line in twenty is worse than one that parses
 * none. And the timestamp is returned as it was written, not as a date: the
 * RFC 3164 syslog format carries neither year nor time zone, and turning
 * « Oct 10 13:55:36 » into an instant means inventing both.
 */

// The pieces a pattern is built from. Deliberately few and deliberately loose:
// a log parser that refuses a line because an address was unusual has lost the
// line, and the line is the point.
export const PIECES = {
  IP: '[0-9A-Fa-f.:]+',
  WORD: '\\S+',
  INT: '-?\\d+',
  DATA: '.*?',
  QUOTED: '[^"]*',
  BRACKETED: '[^\\]]*',
  NOTCOLON: '[^:]+',
  SYSLOGDATE: '\\w{3}\\s+\\d{1,2} \\d{2}:\\d{2}:\\d{2}',
  GREEDY: '.*',
};

// Three formats that cover most of what lands in a log directory. A pattern is
// written once, in this notation, and compiled for the language that reads it —
// Python spells a named group `(?P<name>…)` and JavaScript `(?<name>…)`, which
// is reason enough not to write either by hand in a file read by both.
export const PATTERNS = {
  'apache-combined':
    '%{IP:client} %{WORD:ident} %{WORD:user} \\[%{BRACKETED:timestamp}\\]'
    + ' "%{QUOTED:request}" %{INT:status} %{WORD:size}'
    + ' "%{QUOTED:referrer}" "%{QUOTED:agent}"',
  'syslog-3164':
    '<%{INT:priority}>%{SYSLOGDATE:timestamp} %{WORD:host} %{NOTCOLON:tag}: %{GREEDY:message}',
  'nginx-error':
    '%{BRACKETED:timestamp} \\[%{BRACKETED:level}\\] %{WORD:pid}: %{GREEDY:message}',
};

const NAMED = /%\{(\w+):(\w+)\}/g;

/** Turn the named notation into a regular expression of this language. */
export function compilePattern(pattern) {
  const body = pattern.replace(NAMED, (whole, kind, name) => {
    if (!(kind in PIECES)) throw new Error(`unknown piece ${kind}`);
    return `(?<${name}>${PIECES[kind]})`;
  });
  return new RegExp(`^${body}$`);
}

/**
 * Every line cut into its fields, and every line that could not be.
 *
 * `pattern` is a name from `PATTERNS` or a pattern written in the same
 * notation. `rejected` carries the line number and the line itself: that list
 * is what tells you the format changed under you.
 *
 * @param {Iterable<string>} lines
 * @param {string} pattern
 */
export function parseLines(lines, pattern) {
  let expression;
  try {
    expression = compilePattern(PATTERNS[pattern] ?? pattern);
  } catch {
    return { parsed: [], rejected: [], reason: 'this pattern is not usable' };
  }

  const parsed = [];
  const rejected = [];
  let number = 0;
  for (const line of lines) {
    number += 1;
    if (typeof line !== 'string') {
      rejected.push({ line: number, text: null });
      continue;
    }
    const text = line.replace(/\r?\n$/, '');
    const found = expression.exec(text);
    if (found) parsed.push({ line: number, ...found.groups });
    else rejected.push({ line: number, text });
  }
  return { parsed, rejected, reason: null };
}
