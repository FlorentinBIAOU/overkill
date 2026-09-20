import sys, random
sys.path.insert(0, 'content/snippets/check-bank-details-before-a-transfer')
from stdnum import iban as registre
from n0 import RIB_LETTERS, check_bank_details

SOSIES = {"0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B"}

def cle_iso(pays, bban):
    etendu = "".join(str(int(c, 36)) for c in bban + pays + "00")
    return "%02d" % (98 - int(etendu) % 97)

def cle_rib(banque, guichet, compte):
    chiffres = "".join(RIB_LETTERS.get(c, c) for c in banque + guichet + compte)
    return "%02d" % ((97 - int(chiffres + "00") % 97) % 97)

def ibans_francais(nombre, graine=3):
    alea = random.Random(graine)
    sortie = []
    while len(sortie) < nombre:
        banque, guichet = "%05d" % alea.randint(10000, 99999), "%05d" % alea.randint(0, 99999)
        compte = "%011d" % alea.randint(0, 10**11 - 1)
        bban = banque + guichet + compte + cle_rib(banque, guichet, compte)
        candidat = "FR" + cle_iso("FR", bban) + bban
        if registre.is_valid(candidat):
            sortie.append(candidat)
    return sortie

seule_iso = ensemble = passees = 0
for numero in ibans_francais(500):
    for rang in range(4, len(numero)):
        if numero[rang] not in SOSIES:
            continue
        ensemble += 1
        faute = numero[:rang] + SOSIES[numero[rang]] + numero[rang + 1:]
        if registre.is_valid(faute):
            seule_iso += 1
        if check_bank_details(faute)["valid"]:
            passees += 1
print('ensemble', ensemble, 'seule_iso', seule_iso, 'passees', passees,
      'taux %.4f%%' % (100 * seule_iso / ensemble))
