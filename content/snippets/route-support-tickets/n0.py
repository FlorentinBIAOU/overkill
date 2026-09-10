"""
Route a support ticket with keyword rules: ordered, with a default team.

Rung N0. Deterministic, standard library only, and every decision can be
explained to the person who asks why their ticket landed where it did.

Two things turn a keyword list into a rule a support desk can actually run.

First, an explicit priority. Tickets mention several subjects, so two teams
matching the same ticket is the normal case, not the exception. The order of
RULES answers it once and in writing, rather than leaving it to whichever
branch happens to run first.

Second, a default team. Every ticket must land somewhere; a ticket that
matches nothing has to go to a queue a human watches, not to the floor.
"""

import re
import unicodedata

# The queue that gets everything the rules cannot place. Naming it here, next
# to the rules, is what stops a ticket from silently going nowhere.
DEFAULT_TEAM = "general"

# Business knowledge, kept next to the code that applies it.
#
# The order is the priority, and it is a business decision, not a detail of
# implementation: a billing problem has a legal clock on it, an outage blocks
# the customer's work, a parcel is the one that can wait a day. Whoever
# disagrees can reorder this tuple and nothing else.
RULES = (
    ("billing", ("facture", "remboursement", "prélèvement", "iban", "devis", "paiement")),
    ("technical", ("bug", "erreur", "panne", "connexion", "mot de passe", "identifiant")),
    ("shipping", ("livraison", "colis", "transporteur", "expédition", "suivi", "retard")),
)


def _fold(text: str) -> str:
    """Lowercase and drop accents, so « Prélèvement » matches « prelevement »."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


# A word boundary on the left only. « facture » then also matches « factures »
# and « facturation », which is what French tickets are full of; the price is
# that it would match a longer word starting the same way.
_COMPILED = tuple(
    (team, tuple((word, re.compile(rf"\b{re.escape(_fold(word))}")) for word in words))
    for team, words in RULES
)


def matches(ticket: str) -> dict[str, list[str]]:
    """
    Every team the ticket triggers, with the words that triggered it.

    The routing decision needs only the first team, but the reviewer of a
    misrouted ticket needs this: it shows what the rules saw, and what they
    had to drop.
    """
    folded = _fold(ticket)
    found = {}
    for team, patterns in _COMPILED:
        hits = [word for word, pattern in patterns if pattern.search(folded)]
        if hits:
            found[team] = hits
    return found


def route(ticket: str, default_team: str = DEFAULT_TEAM) -> str:
    """The team that gets the ticket. Always one, and always a real queue."""
    found = matches(ticket)
    for team, _ in RULES:
        if team in found:
            return team
    return default_team
