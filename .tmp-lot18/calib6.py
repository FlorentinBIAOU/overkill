import sys, unicodedata
sys.path.insert(0, 'content/snippets/know-whether-a-pdf-needs-ocr')
sys.path.insert(0, '.tmp-lot18')
from n1 import fit, score, MARGIN
from corpus6 import CORPUS_ACCENTUE, NEUVES

def rapport(corpus, nom):
    m = fit(corpus)
    print(f"--- {nom} : seuil {m['threshold']:.4f} (marge {MARGIN})")
    for i, p in enumerate(corpus):
        print(f"   entrainement {i} {score(p, m):.4f}")
    for i, p in enumerate(NEUVES):
        s = score(p, m)
        print(f"   neuve {i} {s:.4f} {'lisible' if s >= m['threshold'] else 'REFUSÉE'}")
    # validation croisée : ajuster sur cinq, noter la sixième
    print("   validation croisée :")
    for i in range(len(corpus)):
        reste = corpus[:i] + corpus[i+1:]
        mm = fit(reste)
        s = score(corpus[i], mm)
        print(f"     retenue {i}: score {s:.4f} seuil {mm['threshold']:.4f} "
              f"{'ok' if s >= mm['threshold'] else 'REFUSÉE'}")
    # marge minimale pour que les quatre neuves passent
    m_sans_marge = fit(corpus)
    brut = m_sans_marge['threshold'] + MARGIN
    besoins = [brut - score(p, m_sans_marge) for p in NEUVES]
    print(f"   marge nécessaire pour les quatre neuves : {max(besoins):.4f}")

rapport(CORPUS_ACCENTUE, "corpus accentué")
