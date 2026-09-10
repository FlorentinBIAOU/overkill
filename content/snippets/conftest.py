"""
Chaque extrait s'importe par son nom court, depuis le dossier de sa fiche :

    from n0 import mask

Cela suppose que le dossier de la fiche soit sur le chemin d'import au moment
où le test est chargé, ce que fait le crochet ci-dessous. Les doubles locaux du
harnais sont rendus disponibles sous le préfixe `_harness`.

Sans cela, un test devrait manipuler sys.path lui-même, ce qui parasiterait la
lecture de l'extrait, or l'extrait et son test sont montrés au lecteur.
"""

import sys
from pathlib import Path

SNIPPETS = Path(__file__).parent


def pytest_collect_file(file_path, parent):
    """Met le dossier de la fiche sur le chemin d'import avant collecte."""
    for chemin in (str(file_path.parent), str(SNIPPETS)):
        if chemin not in sys.path:
            sys.path.insert(0, chemin)
    return None


# ---------------------------------------------------------------------------
# Garde réseau
#
# Un extrait ne doit jamais toucher le réseau, ni à l'exécution ni pendant son
# test. Les barreaux N2 et N3 emploient les doubles locaux de _harness/.
#
# Plutôt que de compter sur un bac à sable extérieur, la garde est posée ici :
# elle est active partout, y compris sur la machine d'un contributeur.
# ---------------------------------------------------------------------------

import socket

import pytest


class AccesReseauInterdit(RuntimeError):
    """Un extrait ou son test a tenté d'ouvrir une connexion."""


@pytest.fixture(autouse=True)
def _interdire_le_reseau(monkeypatch):
    def refuser(*args, **kwargs):
        raise AccesReseauInterdit(
            "un extrait a tenté d'accéder au réseau. "
            "Les barreaux N2 et N3 se testent avec les doubles de _harness/."
        )

    monkeypatch.setattr(socket, "socket", refuser)
    monkeypatch.setattr(socket, "create_connection", refuser)
    monkeypatch.setattr(socket, "getaddrinfo", refuser)
