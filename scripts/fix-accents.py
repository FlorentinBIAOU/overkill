#!/usr/bin/env python3
"""
Corrige les accents manquants dans la prose et les commentaires français.

Ne remplace un mot que s'il existe une accentuation, et une seule, que le
dictionnaire français reconnaisse. Les cas ambigus sont signalés, jamais
corrigés d'office.
"""
import itertools
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

cf = import_module("check-french")

ACCENTS = cf.ACCENTS
DICT = cf.DICT


def candidats(mot: str, limite: int = 20000) -> list[str]:
    positions = [i for i, c in enumerate(mot) if c in ACCENTS]
    if not positions or len(positions) > 6:
        return []
    total = 1
    for i in positions:
        total *= len(ACCENTS[mot[i]])
    if total > limite:
        return []
    trouves = []
    for combo in itertools.product(*(ACCENTS[mot[i]] for i in positions)):
        cand = list(mot)
        for i, c in zip(positions, combo):
            cand[i] = c
        cand = "".join(cand)
        if cand != mot and (DICT.lookup(cand) or DICT.lookup(cand.lower())):
            trouves.append(cand)
    return trouves


def main() -> int:
    lexique = set()
    if cf.LEXIQUE.exists():
        for l in cf.LEXIQUE.read_text(encoding="utf8").split("\n"):
            l = l.split("#")[0].strip().lower()
            if l:
                lexique.add(l)

    motifs = sys.argv[1:] or cf.DEFAUT
    fichiers = []
    for motif in motifs:
        p = Path(motif)
        fichiers.extend([p] if p.is_file() else sorted(Path(".").glob(motif)))

    remplacements: dict[str, str] = {}
    ambigus: dict[str, list[str]] = {}

    for f in fichiers:
        for _, _pos, mot in cf.mots_du_fichier(f):
            if cf.accepte(mot, lexique) or mot in remplacements or mot in ambigus:
                continue
            c = candidats(mot)
            if len(c) == 1:
                remplacements[mot] = c[0]
            elif len(c) > 1:
                ambigus[mot] = c

    if ambigus:
        print("Ambigus, à corriger à la main :")
        for mot, c in sorted(ambigus.items()):
            print(f"  {mot}  →  {' ou '.join(c)}")
        print()

    if not remplacements:
        print("fix-accents : rien à corriger")
        return 0

    print(f"fix-accents : {len(remplacements)} mot(s) corrigé(s)")
    for mot, corrige in sorted(remplacements.items()):
        print(f"  {mot}  →  {corrige}")

    # La correction se fait aux positions exactes rendues par le masque de
    # prose : un identifiant de code qui s'écrirait comme un mot mal accentué
    # n'est jamais touché.
    touches = 0
    for f in fichiers:
        texte = f.read_text(encoding="utf8")
        edits = [
            (pos, mot, remplacements[mot])
            for _, pos, mot in cf.mots_du_fichier(f)
            if mot in remplacements
        ]
        if not edits:
            continue
        for pos, mot, corrige in sorted(edits, reverse=True):
            assert texte[pos : pos + len(mot)] == mot, (f, pos, mot)
            texte = texte[:pos] + corrige + texte[pos + len(mot) :]
        f.write_text(texte, encoding="utf8")
        touches += 1
    print(f"  {touches} fichier(s) modifié(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
