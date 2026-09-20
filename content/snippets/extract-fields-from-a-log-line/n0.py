"""
Cut a log line into fields with a named pattern.

Rung N0. A log line is not free text: it was written by a program, with a
format fixed by that program, and often by a standard. There is nothing to
infer — the shape is known before the first line arrives, which is exactly the
situation a regular expression was invented for.

What makes the difference at volume is not the expression but the vocabulary
around it. Grok, the notation Logstash made common, names the pieces once —
`%{IP:client}`, `%{INT:status}` — and lets a line be described by its fields
rather than by a wall of brackets. The dozen lines below are that idea, with
the pieces this entry needs; the real libraries ship a few hundred of them.

Two rules the rest of this file exists for. A line that does not match is never
dropped: it comes back in `rejected`, with its number, because a log parser
that quietly loses one line in twenty is worse than one that parses none. And
the timestamp is returned as it was written, not as a date: the RFC 3164 syslog
format carries neither year nor time zone, and turning « Oct 10 13:55:36 » into
an instant means inventing both.
"""

from __future__ import annotations

import re

# The pieces a pattern is built from. Deliberately few and deliberately loose:
# a log parser that refuses a line because an address was unusual has lost the
# line, and the line is the point.
PIECES = {
    "IP": r"[0-9A-Fa-f.:]+",
    "WORD": r"\S+",
    "INT": r"-?\d+",
    "DATA": r".*?",
    "QUOTED": r"[^\"]*",
    "BRACKETED": r"[^\]]*",
    "NOTCOLON": r"[^:]+",
    "SYSLOGDATE": r"\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}",
    "GREEDY": r".*",
}

# Three formats that cover most of what lands in a log directory. A pattern is
# written once, in this notation, and compiled for the language that reads it —
# Python spells a named group `(?P<name>…)` and JavaScript `(?<name>…)`, which
# is reason enough not to write either by hand in a file read by both.
PATTERNS = {
    "apache-combined": (
        r"%{IP:client} %{WORD:ident} %{WORD:user} \[%{BRACKETED:timestamp}\]"
        r' "%{QUOTED:request}" %{INT:status} %{WORD:size}'
        r' "%{QUOTED:referrer}" "%{QUOTED:agent}"'
    ),
    "syslog-3164": (
        r"<%{INT:priority}>%{SYSLOGDATE:timestamp} %{WORD:host} %{NOTCOLON:tag}: %{GREEDY:message}"
    ),
    "nginx-error": (
        r"%{BRACKETED:timestamp} \[%{BRACKETED:level}\] %{WORD:pid}: %{GREEDY:message}"
    ),
}

NAMED = re.compile(r"%\{(\w+):(\w+)\}")


def compile_pattern(pattern: str):
    """Turn the named notation into a regular expression of this language."""
    def piece(match):
        kind, name = match.group(1), match.group(2)
        if kind not in PIECES:
            raise KeyError(f"unknown piece {kind}")
        return f"(?P<{name}>{PIECES[kind]})"

    return re.compile(f"^{NAMED.sub(piece, pattern)}$")


def parse_lines(lines, pattern: str) -> dict:
    """
    Every line cut into its fields, and every line that could not be.

    `pattern` is a name from `PATTERNS` or a pattern written in the same
    notation. `rejected` carries the line number and the line itself: that list
    is what tells you the format changed under you.
    """
    try:
        expression = compile_pattern(PATTERNS.get(pattern, pattern))
    except (KeyError, re.error):
        return {"parsed": [], "rejected": [], "reason": "this pattern is not usable"}

    parsed, rejected = [], []
    for number, line in enumerate(lines, start=1):
        if not isinstance(line, str):
            rejected.append({"line": number, "text": None})
            continue
        found = expression.match(line.rstrip("\r\n"))
        if found:
            parsed.append({"line": number, **found.groupdict()})
        else:
            rejected.append({"line": number, "text": line.rstrip("\r\n")})
    return {"parsed": parsed, "rejected": rejected, "reason": None}
