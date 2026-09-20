import sys
sys.path.insert(0, 'content/snippets/know-whether-a-pdf-needs-ocr')
sys.path.insert(0, '.tmp-lot18')
from n1 import fit, score
from corpus6 import CORPUS_ACCENTUE, NEUVES
from fixtures import MOJIBAKE_TEXTE

TABLEAU = ("12/01/2026 1 250,00 4 300,50\n13/01/2026 890,00 5 190,50\n"
           "14/01/2026 2 100,75 7 291,25\n15/01/2026 340,00 7 631,25\n"
           "16/01/2026 1 875,40 9 506,65")
ANGLAIS = ("The parties agree that this agreement shall be governed by and construed in"
           " accordance with the laws of England and Wales, and that the courts of London"
           " shall have exclusive jurisdiction over any dispute arising out of it.")

m = fit(CORPUS_ACCENTUE)
brut = min(score(p, m) for p in CORPUS_ACCENTUE)
print('min entrainement', round(brut, 4))
for nom, texte in [('mojibake', MOJIBAKE_TEXTE), ('tableau', TABLEAU), ('anglais', ANGLAIS)]:
    print(nom, round(score(texte, m), 4))
for i, p in enumerate(NEUVES):
    print('neuve', i, round(score(p, m), 4))
