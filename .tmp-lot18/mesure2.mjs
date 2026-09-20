import { RIB_LETTERS, checkBankDetails } from '../content/snippets/check-bank-details-before-a-transfer/n0.js';
const SOSIES = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B' };
const cleIso = (pays, bban) => String(98n - (BigInt([...(bban + pays + '00')].map((c) => parseInt(c, 36)).join('')) % 97n)).padStart(2, '0');
const cleRib = (b, g, c) => String((97n - (BigInt(`${[...(b + g + c)].map((x) => RIB_LETTERS[x] ?? x).join('')}00`) % 97n)) % 97n).padStart(2, '0');
function alea(graine) { let etat = graine >>> 0; return () => { etat = (etat * 1664525 + 1013904223) >>> 0; return etat / 2 ** 32; }; }
function ibansFrancais(nombre, graine = 3) {
  const suivant = alea(graine); const entier = (max) => Math.floor(suivant() * max); const sortie = [];
  while (sortie.length < nombre) {
    const banque = String(10000 + entier(90000));
    const guichet = String(entier(100000)).padStart(5, '0');
    const compte = String(entier(10 ** 11)).padStart(11, '0');
    const bban = banque + guichet + compte + cleRib(banque, guichet, compte);
    const candidat = `FR${cleIso('FR', bban)}${bban}`;
    if (checkBankDetails(candidat).valid) sortie.push(candidat);
  }
  return sortie;
}
let ensemble = 0, seuleIso = 0, passees = 0;
for (const numero of ibansFrancais(500)) {
  for (let rang = 4; rang < numero.length; rang += 1) {
    if (!(numero[rang] in SOSIES)) continue;
    ensemble += 1;
    const faute = numero.slice(0, rang) + SOSIES[numero[rang]] + numero.slice(rang + 1);
    const rapport = checkBankDetails(faute);
    if (rapport.valid || rapport.national_key === false) seuleIso += 1;
    if (rapport.valid) passees += 1;
  }
}
console.log('ensemble', ensemble, 'seuleIso', seuleIso, 'passees', passees, 'taux', (100 * seuleIso / ensemble).toFixed(4) + '%');
let e=0,p=0;
for (const numero of ibansFrancais(100)) {
  for (let rang = 4; rang < numero.length; rang += 1) {
    for (const chiffre of '0123456789') {
      if (chiffre === numero[rang]) continue;
      e += 1;
      if (checkBankDetails(numero.slice(0,rang)+chiffre+numero.slice(rang+1)).valid) p += 1;
    }
  }
}
console.log('un-chiffre essais', e, 'passees', p);
let e2=0,p2=0;
for (const numero of ibansFrancais(100)) {
  for (let rang = 4; rang < numero.length - 1; rang += 1) {
    if (numero[rang] === numero[rang+1]) continue;
    e2 += 1;
    const permute = numero.slice(0,rang)+numero[rang+1]+numero[rang]+numero.slice(rang+2);
    if (checkBankDetails(permute).valid) p2 += 1;
  }
}
console.log('transpositions essais', e2, 'passees', p2);
