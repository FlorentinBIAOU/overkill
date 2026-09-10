"""
Search your own documents with the full-text index of the database you
already run.

Rung N0. SQLite ships FTS5: a virtual table holding an inverted index, and a
bm25() ranking function. Postgres has tsvector and ts_rank, MySQL has
FULLTEXT ... IN NATURAL LANGUAGE MODE. Whatever is under your application
already does this, and does it well.

Two things are worth knowing before you use it.

First, bm25() returns a negative number, the best match being the most
negative. Negate it, as below, and a bigger score means a better match again.

Second, MATCH takes a query language, not a string. A user typing a double
quote, AND or NEAR must never be handed to it raw: quoting each token turns
the query back into plain words, and turns a syntax error into a search.
"""

import sqlite3
import unicodedata

# A title match counts for more than a body match. bm25() takes one weight per
# column, in the order the columns were declared.
COLUMN_WEIGHTS = (0.0, 10.0, 1.0)  # doc_id, title, body

CREATE = (
    "CREATE VIRTUAL TABLE documents USING fts5("
    "doc_id UNINDEXED, title, body, tokenize='unicode61 remove_diacritics 2')"
)


def tokenise(text: str) -> list[str]:
    """Lower case, strip accents, keep letters and digits.

    The same folding as the tokenizer declared above, so what we look up is
    spelled the way the index stored it.
    """
    decomposed = unicodedata.normalize("NFKD", text.lower())
    letters = "".join(c for c in decomposed if not unicodedata.combining(c))
    return "".join(c if c.isalnum() else " " for c in letters).split()


def build_index(documents: list[dict]) -> sqlite3.Connection:
    """Documents are dicts with keys id, title and body.

    In memory here so the snippet runs alone; in production it is a table in
    the database you already back up, filled by a trigger or a nightly job.
    """
    connection = sqlite3.connect(":memory:")
    connection.execute(CREATE)
    connection.executemany(
        "INSERT INTO documents (doc_id, title, body) VALUES (?, ?, ?)",
        [(d["id"], d["title"], d["body"]) for d in documents],
    )
    return connection


def search(connection: sqlite3.Connection, query: str, limit: int = 5) -> list[dict]:
    """Return the best matches, best first, as dicts with keys id and score."""
    terms = tokenise(query)
    if not terms:
        # An empty MATCH is a syntax error, not an empty result set.
        return []
    # Quoted terms, separated by a space: FTS5 requires all of them to appear.
    match = " ".join(f'"{term}"' for term in terms)
    rows = connection.execute(
        "SELECT doc_id, -bm25(documents, ?, ?, ?) AS score FROM documents "
        "WHERE documents MATCH ? ORDER BY score DESC, doc_id LIMIT ?",
        (*COLUMN_WEIGHTS, match, limit),
    ).fetchall()
    return [{"id": doc_id, "score": round(score, 4)} for doc_id, score in rows]
