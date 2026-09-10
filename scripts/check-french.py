#!/usr/bin/env python3
"""
Vérification orthographique du français du projet.

Le site est bilingue et l'une de ses deux langues est le français. Un texte
français sans accents est une faute, dans le contenu comme dans les
commentaires du code. Ce contrôle attrape les mots que le dictionnaire
français ne connaît pas.

Usage :
    .venv-tools/bin/python scripts/check-french.py [chemins...]

Les mots légitimes hors dictionnaire (termes techniques, noms propres) sont
listés dans scripts/lexique-projet.txt.
"""
import re
import sys
import unicodedata
from pathlib import Path

from spylls.hunspell import Dictionary

DICT = Dictionary.from_files("/usr/share/hunspell/fr_FR")
LEXIQUE = Path(__file__).parent / "lexique-projet.txt"

DEFAUT = [
    "docs/sprints/*.md",
    "src/**/*.astro",
    "src/**/*.ts",
    "src/**/*.css",
    "scripts/*.mjs",
    "content/**/*.mdx",
    "README.md",
    "RAPPORT.md",
    "CONTRIBUTING.md",
]

# Mot français plausible : au moins trois lettres, pas de chiffre, pas de
# casse interne (ce qui écarte camelCase et les identifiants).
MOT = re.compile(r"[A-Za-zÀ-ÿŒœ]{3,}")


# Accents que peut porter chaque voyelle, pour reconstruire un mot mal accentué
# sans passer par le générateur de suggestions, trop lent sur un dépôt entier.
ACCENTS = {
    "a": "aàâä", "e": "eéèêë", "i": "iîï", "o": "oôö",
    "u": "uùûü", "c": "cç", "y": "yÿ",
    "A": "AÀÂÄ", "E": "EÉÈÊË", "I": "IÎÏ", "O": "OÔÖ",
    "U": "UÙÛÜ", "C": "CÇ", "Y": "YŸ",
}


def accentuer(mot: str, limite: int = 20000) -> str | None:
    """Cherche une accentuation du mot que le dictionnaire connaisse."""
    positions = [i for i, c in enumerate(mot) if c in ACCENTS]
    if not positions or len(positions) > 6:
        return None
    total = 1
    for i in positions:
        total *= len(ACCENTS[mot[i]])
    if total > limite:
        return None
    import itertools

    for combo in itertools.product(*(ACCENTS[mot[i]] for i in positions)):
        cand = list(mot)
        for i, c in zip(positions, combo):
            cand[i] = c
        cand = "".join(cand)
        if cand != mot and (DICT.lookup(cand) or DICT.lookup(cand.lower())):
            return cand
    return None


def accepte(mot: str, lexique: set[str]) -> bool:
    if mot.lower() in lexique:
        return True
    if DICT.lookup(mot) or DICT.lookup(mot.lower()):
        return True
    # Un mot entièrement en majuscules est un sigle.
    if mot.isupper():
        return True
    return False


def _masquer(texte: str, motif: re.Pattern) -> str:
    """Remplace chaque occurrence par des espaces, en gardant les positions."""
    return motif.sub(lambda m: re.sub(r"\S", " ", m.group(0)), texte)


def prose_masque(chemin: Path) -> str:
    """
    Renvoie une chaîne de même longueur que le fichier, où tout ce qui n'est
    pas de la prose relisible est remplacé par des espaces.

    Travailler par masquage plutôt que par extraction permet de corriger un mot
    à sa position exacte, sans risquer de toucher un identifiant de code qui
    s'écrirait pareil.
    """
    texte = chemin.read_text(encoding="utf8")
    suffixe = chemin.suffix

    if suffixe in {".md", ".mdx"}:
        for motif in (
            re.compile(r"```.*?```", re.S),
            re.compile(r"~~~.*?~~~", re.S),
            re.compile(r"`[^`\n]*`"),
            re.compile(r"https?://\S+"),
            re.compile(r"<[^>]+>"),
        ):
            texte = _masquer(texte, motif)
        return texte

    # Fichiers de code : seuls les commentaires sont de la prose.
    garde = [False] * len(texte)
    for motif in (
        re.compile(r"/\*.*?\*/", re.S),
        re.compile(r"<!--.*?-->", re.S),
        re.compile(r"(?<![:\w])//[^\n]*"),
        re.compile(r"(?m)^\s*#(?![0-9a-fA-F]{3,8}\b)[^\n]*"),
    ):
        for m in motif.finditer(texte):
            for i in range(m.start(), m.end()):
                garde[i] = True

    out = list(texte)
    for i, c in enumerate(out):
        if not garde[i] and not c.isspace():
            out[i] = " "
    masque = "".join(out)
    for motif in (re.compile(r"https?://\S+"), re.compile(r"`[^`\n]*`")):
        masque = _masquer(masque, motif)
    return masque


def mots_du_fichier(chemin: Path):
    """Rend (numéro de ligne, position absolue, mot) pour chaque mot de prose."""
    masque = prose_masque(chemin)
    for m in MOT.finditer(masque):
        mot = m.group(0)
        if mot != mot.lower() and mot != mot.capitalize():
            continue
        ligne_no = masque.count("\n", 0, m.start()) + 1
        yield ligne_no, m.start(), mot


def main() -> int:
    lexique = set()
    if LEXIQUE.exists():
        for l in LEXIQUE.read_text(encoding="utf8").split("\n"):
            l = l.split("#")[0].strip().lower()
            if l:
                lexique.add(l)

    motifs = sys.argv[1:] or DEFAUT
    fichiers = []
    for motif in motifs:
        p = Path(motif)
        fichiers.extend([p] if p.is_file() else sorted(Path(".").glob(motif)))

    inconnus: dict[str, list[str]] = {}
    for f in fichiers:
        for ligne_no, _pos, mot in mots_du_fichier(f):
            if not accepte(mot, lexique):
                inconnus.setdefault(mot, []).append(f"{f}:{ligne_no}")

    if not inconnus:
        print(f"check-french : OK ({len(fichiers)} fichiers)")
        return 0

    print(f"check-french : {len(inconnus)} mot(s) hors dictionnaire français\n")
    for mot, lieux in sorted(inconnus.items(), key=lambda kv: -len(kv[1])):
        sans_accent = "".join(
            c for c in unicodedata.normalize("NFD", mot) if unicodedata.category(c) != "Mn"
        )
        indice = ""
        if sans_accent == mot:
            corrige = accentuer(mot)
            if corrige:
                indice = f"  →  {corrige}"
        print(f"  {mot}{indice}")
        for lieu in lieux[:3]:
            print(f"      {lieu}")
        if len(lieux) > 3:
            print(f"      … et {len(lieux) - 3} autres")
    print(
        "\nAjouter les termes légitimes à scripts/lexique-projet.txt, "
        "corriger les autres."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
