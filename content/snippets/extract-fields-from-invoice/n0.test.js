import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AMOUNT,
  UnreadableInvoice,
  extractFields,
  findAfterLabel,
  parseAmount,
  readInvoice,
  readStructured,
} from './n0.js';

// La même facture dans les deux syntaxes du socle, réduite aux éléments que
// l'extrait lit. Une facture réelle en porte cent de plus, à la même place.
const CII = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>FA-2026-0187</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260915</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>69.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">13.80</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>82.80</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`);

const UBL = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ID>FA-2026-0187</cbc:ID>
  <cbc:IssueDate>2026-09-15</cbc:IssueDate>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">13.80</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount>69.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount>82.80</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount>82.80</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`);

const READ = {
  source: 'structured',
  invoice_number: 'FA-2026-0187',
  date: '2026-09-15',
  total_excluding_vat: 69,
  vat: 13.8,
  total: 82.8,
  totals_agree: true,
};

const remplace = (buffer, avant, apres) => Buffer.from(String(buffer).replace(avant, apres));

// Two invoices, two suppliers, both already turned into text. Nothing here is
// unusual: this is what a French invoice looks like once the PDF has given up
// its characters.

const LAMBERT = `
PAPETERIE LAMBERT
12 rue des Acacias — 69003 Lyon

Facture n° FA-2024-0187
Date : 14/03/2024
Client : Studio Vermeil

Réf     Désignation                Qté   PU HT    Montant HT
A-11    Ramette A4 80 g             10    4,90       49,00
B-02    Stylo bille noir            25    0,80       20,00

                          Total HT      69,00 €
                          TVA 20 %      13,80 €
                          Total TTC     82,80 €
`;

const NORD = `
NORD FOURNITURES SAS
Facture

                                          N° 2024-000431
                                          Émise le 3 avril 2024

Désignation                        Qté     Prix      Total
Cartouche encre noire                2    38,50      77,00

                          Sous-total                 77,00
                          TVA (20 %)                 15,40
                          NET A PAYER                92,40 EUR
`;

// ---------------------------------------------------------------------------
// La porte structurée : ce que la réforme fait arriver depuis le 1er septembre 2026
// ---------------------------------------------------------------------------

test('lit les deux syntaxes du socle, et dit par où la réponse est passée', () => {
  // « the minimum set of formats is UBL, CII and Factur-X » ; « say which door
  // the answer came through ». Factur-X porte le CII dans le PDF : même XML.
  assert.deepEqual(readStructured(CII), READ);
  assert.deepEqual(readStructured(UBL), READ);
  assert.equal(readInvoice(CII).source, 'structured');
  assert.equal(readInvoice(LAMBERT).source, 'text');
});

test('les dates des deux syntaxes rendent la même forme', () => {
  // « CII writes 20260915, UBL writes 2026-09-15; the caller gets one shape. »
  assert.equal(readStructured(CII).date, '2026-09-15');
  assert.equal(readStructured(UBL).date, '2026-09-15');
  assert.equal(readStructured(remplace(CII, '20260915', '')).date, null);
});

test('la règle BR-CO-15 attrape une facture dont les totaux ne tombent pas', () => {
  // Règle BR-CO-15 de la norme : « Montant total de la facture TVA comprise
  // (BT-112) = Montant total de la facture hors TVA (BT-109) + Montant total de
  // TVA de la facture (BT-110) ».
  assert.equal(readStructured(CII).totals_agree, true);
  const faux = remplace(CII, '<ram:GrandTotalAmount>82.80', '<ram:GrandTotalAmount>83.80');
  const lu = readStructured(faux);
  assert.equal(lu.totals_agree, false);
  // La facture est rendue quand même : « a reason to look, not a reason to reject ».
  assert.equal(lu.total, 83.8);
  const limite = remplace(CII, '<ram:GrandTotalAmount>82.80', '<ram:GrandTotalAmount>82.81');
  assert.equal(readStructured(limite).totals_agree, false);
});

test('sans les trois montants, la règle ne dit rien plutôt que faux', () => {
  // « Null when the invoice does not carry the three amounts the rule needs. »
  const sansTva = remplace(CII, '<ram:TaxTotalAmount currencyID="EUR">13.80</ram:TaxTotalAmount>', '');
  const lu = readStructured(sansTva);
  assert.equal(lu.vat, null);
  assert.equal(lu.totals_agree, null);
  assert.equal(lu.invoice_number, 'FA-2026-0187');
});

test('un document qui n’est pas une facture est refusé plutôt que lu à moitié', () => {
  assert.throws(() => readStructured(Buffer.from("<Order xmlns='urn:x'><ID>1</ID></Order>")), UnreadableInvoice);
  assert.throws(() => readStructured(remplace(CII, '<ram:ID>FA-2026-0187</ram:ID>', '')), {
    name: 'Error',
    message: 'no invoice number in the document',
  });
});

test('la porte structurée ne dépend pas des préfixes de namespace', () => {
  // « One pair is enough to find them without carrying a page of namespace
  // declarations. »
  let autre = String(CII);
  for (const [ancien, nouveau] of [['rsm', 'a'], ['ram', 'b'], ['udt', 'c']]) {
    autre = autre.replaceAll(`xmlns:${ancien}=`, `xmlns:${nouveau}=`).replaceAll(`${ancien}:`, `${nouveau}:`);
  }
  assert.deepEqual(readStructured(Buffer.from(autre)), READ);
});

test('la porte structurée n’est pas trompée par un identifiant de ligne', () => {
  // Une facture réelle porte un `ram:ID` par ligne de produit : c'est le couple
  // (parent, enfant) qui les écarte.
  const avecLignes = remplace(
    CII,
    '<rsm:SupplyChainTradeTransaction>',
    '<rsm:SupplyChainTradeTransaction><ram:IncludedSupplyChainTradeLineItem>'
      + '<ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID><ram:ID>LIGNE-1</ram:ID>'
      + '</ram:AssociatedDocumentLineDocument></ram:IncludedSupplyChainTradeLineItem>',
  );
  assert.equal(readStructured(avecLignes).invoice_number, 'FA-2026-0187');
});

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le fournisseur suivant fait tomber les trois champs', () => {
  const fields = extractFields(NORD);
  assert.equal(fields.invoice_number, null);
  assert.equal(fields.date, null);
  assert.notEqual(fields.total, 92.4);
  // Witness: the Lambert invoice is read in full.
  assert.equal(extractFields(LAMBERT).invoice_number, 'FA-2024-0187');
  assert.equal(extractFields(LAMBERT).total, 82.8);
});

test('point de rupture : deux champs tombent à vide, et cela se voit', () => {
  const fields = extractFields(NORD);
  const lus = ['invoice_number', 'date', 'total'];
  assert.deepEqual(lus.filter((name) => fields[name] === null), ['invoice_number', 'date']);
});

test('point de rupture : le total revient bien formé et faux, parce que « Sous-total » contient « total »', () => {
  assert.equal(extractFields(NORD).total, 77);
  assert.equal(findAfterLabel(NORD, ['total'], AMOUNT), '77,00');
  // Witness: without the word « Sous-total », the same line gives nothing.
  assert.equal(extractFields(NORD.replace('Sous-total', 'Montant HT')).total, null);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit la facture pour laquelle il a été écrit', () => {
  assert.deepEqual(extractFields(LAMBERT), {
    source: 'text',
    invoice_number: 'FA-2024-0187',
    date: '14/03/2024',
    total: 82.8,
    total_excluding_vat: null,
    vat: null,
    totals_agree: null,
  });
});

test('lit des libellés en capitales et un montant groupé', () => {
  const invoice = 'FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €';
  const fields = extractFields(invoice);
  assert.deepEqual(
    [fields.invoice_number, fields.date, fields.total],
    ['FA-2024-0201', '02/12/2024', 1234.56],
  );
});

test('un libellé sans valeur sur sa ligne est ignoré', () => {
  assert.equal(extractFields('Qté   Prix   Total\n\nTotal TTC   45,00 €').total, 45);
});

test('les libellés sont rangés du plus précis au moins précis, Total TTC avant Total HT', () => {
  assert.equal(extractFields(LAMBERT).total, 82.8);
  // Witness: with the least specific label alone, the plausible wrong number comes back.
  assert.equal(findAfterLabel(LAMBERT, ['total'], AMOUNT), '69,00');
});

test('parseAmount lit les deux graphies', () => {
  assert.equal(parseAmount('1.234,56 €'), 1234.56);
  assert.equal(parseAmount('82,80'), 82.8);
  assert.equal(parseAmount('92.40'), 92.4);
});

test('trois chiffres par groupe séparent une quantité d’un prix, mais pas toujours', () => {
  // Commentaire d'AMOUNT : « Exactly three digits per group keeps "2 38,50"
  // apart, a quantity then a price; "2 380,50" still reads as one number. »
  // C'est la limite de la règle, écrite dans le commentaire et démontrée ici.
  assert.equal('Cartouche encre noire 2 38,50'.match(AMOUNT)[0], '38,50');
  assert.equal('Cartouche encre noire 2 380,50'.match(AMOUNT)[0], '2 380,50');
});

test('l’extrait n’importe qu’un lecteur XML, et rien d’autre', () => {
  // Python lit le XML avec sa bibliothèque standard ; Node n'en a pas, d'où la
  // seule dépendance de ce fichier. Rien ne sort de la machine : risks.data_egress none.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^\s*import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['fast-xml-parser']);
  assert.doesNotMatch(source, /\brequire\(|\bfetch\(/);
  assert.deepEqual(extractFields(LAMBERT), extractFields(LAMBERT));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide ou blanc', () => {
  const vide = {
    source: 'text', invoice_number: null, date: null, total: null,
    total_excluding_vat: null, vat: null, totals_agree: null,
  };
  assert.deepEqual(extractFields(''), vide);
  assert.deepEqual(extractFields('\n   \n\t'), vide);
});

test('production : un document de neuf mégaoctets dans une borne large', () => {
  const big = LAMBERT.repeat(20_000);
  const debut = performance.now();
  assert.equal(extractFields(big).total, 82.8);
  assert.ok(performance.now() - debut < 10_000);
});

test('production : espace insécable et espace fine dans le montant', () => {
  assert.equal(extractFields('Total TTC 1\u00a0234,56 €').total, 1234.56);
  assert.equal(extractFields('Total TTC 1\u202f234,56 €').total, 1234.56);
});

test('production : une espace insécable dans « Total TTC » rend le Total HT', () => {
  assert.equal(extractFields(LAMBERT.replace('Total TTC', 'Total\u00a0TTC')).total, 82.8);
});

test('production : un montant à l’anglaise est lu sans erreur et faux', () => {
  assert.ok([1234.56, null].includes(extractFields('TOTAL TTC : 1,234.56 USD').total));
});

test('production : le total négatif d’un avoir garde son signe', () => {
  assert.equal(extractFields("Facture d'avoir n° AV-2024-0012\nTotal TTC -82,80 €").total, -82.8);
});

test('production : valeurs aux limites du montant', () => {
  assert.equal(extractFields('Total TTC 0,00 €').total, 0);
  assert.equal(extractFields('Total TTC 999,99 €').total, 999.99);
  assert.equal(extractFields('Total TTC 1 000,00 €').total, 1000);
  assert.equal(extractFields('Total TTC 1 234 567,89 €').total, 1234567.89);
  assert.equal(extractFields('Total TTC 12,5 €').total, null);
});

test('production : un motif conçu pour faire exploser la référence termine', () => {
  const debut = performance.now();
  extractFields(`Facture n° ${'1-'.repeat(50_000)}!`);
  extractFields(`Total TTC ${'1 '.repeat(50_000)}x`);
  assert.ok(performance.now() - debut < 10_000);
});
