/**
 * Essai figé — transformer un tableau HTML en grille de données.
 *
 * L'extrait du niveau recommandé charge un moteur de document pour analyser le
 * HTML : le faire tourner dans la page ajouterait des dizaines de kilooctets de
 * JavaScript à une fiche qui tient dans quelques-uns. Les six cas ci-dessous
 * sont donc exécutés à la construction du site, avec le vrai extrait et ses
 * vraies dépendances — rien n'est simulé, seule l'exécution est figée.
 *
 * Ce qui est surligné dans le résultat est la valeur d'origine d'une cellule
 * fusionnée ; ses répétitions sont rendues entre parenthèses, parce que c'est
 * tout le sujet de la fiche.
 */
import { extractTables } from '../../snippets/extract-a-table-from-a-web-page/n0.js';

const T = {
  fr: {
    lu: (l, c) => `${l} ligne(s) sur ${c} colonne(s)`,
    rien: 'Aucun tableau dans ce texte',
    plusieurs: (n) => ` · ${n} tableaux trouvés, le premier est montré`,
    legende: (c) => `Légende : ${c}.`,
    imbrique: 'Ce tableau en contient un autre, rendu à part.',
    repete: (texte) => `(${texte})`,
  },
  en: {
    lu: (l, c) => `${l} row(s) over ${c} column(s)`,
    rien: 'No table in this text',
    plusieurs: (n) => ` · ${n} tables found, the first one is shown`,
    legende: (c) => `Caption: ${c}.`,
    imbrique: 'This table holds another one, returned separately.',
    repete: (texte) => `(${texte})`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Une cellule entre parenthèses est la répétition d’une cellule fusionnée, pas une valeur écrite dans la page. Les six tableaux ci-dessous sont lus par le vrai extrait, à la construction du site.',
    en: 'A cell in brackets is the repeat of a merged cell, not a value written in the page. The six tables below are read by the real snippet, when the site is built.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = extractTables(input);
    if (rapport.tables.length === 0) return { verdict: { label: t.rien } };

    const table = rapport.tables[0];
    const entete = table.rows.length && table.rows[0].every((c) => c.header)
      ? table.rows[0].map((c) => c.text) : table.rows[0]?.map((_, i) => String(i + 1)) ?? [];
    const lignes = (table.rows[0]?.every((c) => c.header) ? table.rows.slice(1) : table.rows)
      .map((ligne) => ligne.map((cellule) => (cellule.repeated
        ? t.repete(cellule.text)
        : { v: cellule.text, caught: true })));

    const details = [
      table.caption ? t.legende(table.caption) : '',
      table.nested ? t.imbrique : '',
    ].filter(Boolean).join(' ');

    return {
      rows: { columns: entete, rows: lignes },
      verdict: {
        label: t.lu(table.rows.length, table.columns)
          + (rapport.tables.length > 1 ? t.plusieurs(rapport.tables.length) : ''),
        detail: details || undefined,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Un tableau sans aucune ligne', en: 'A table with no row at all' },
      input: '<table><caption>Commande à venir</caption></table>',
    },
    {
      label: { fr: 'Une ligne plus courte que les autres', en: 'A row shorter than the others' },
      input: '<table><tr><td>Moulin</td><td>2</td></tr><tr><td>Vélo</td></tr></table>',
    },
    {
      label: { fr: 'Un tableau simple, sans fusion', en: 'A plain table, no merged cells' },
      input: '<table><tr><th>Article</th><th>Quantité</th></tr>'
        + '<tr><td>Moulin</td><td>2</td></tr><tr><td>Vélo</td><td>1</td></tr></table>',
    },
    {
      label: { fr: 'Le même, avec une légende et des sections', en: 'The same, with a caption and sections' },
      input: '<table><caption>Commande 2026-118</caption>'
        + '<thead><tr><th>Article</th><th>Quantité</th></tr></thead>'
        + '<tbody><tr><td>Moulin</td><td>2</td></tr><tr><td>Vélo</td><td>1</td></tr></tbody></table>',
    },
    {
      label: { fr: 'Un tableau dans une cellule d’un autre', en: 'A table inside a cell of another' },
      input: '<table><tr><td>Détail<table><tr><td>interne</td></tr></table></td>'
        + '<td>Voisine</td></tr></table>',
    },
    {
      label: { fr: 'Des cellules fusionnées, en largeur et en hauteur', en: 'Merged cells, across and down' },
      input: '<table><tr><th>Article</th><th colspan="2">Prix</th></tr>'
        + '<tr><td>Moulin</td><td>HT</td><td>TTC</td></tr>'
        + '<tr><td rowspan="2">Lot</td><td>1</td><td>2</td></tr>'
        + '<tr><td>3</td><td>4</td></tr>'
        + '<tr><td colspan="3">Total</td></tr></table>',
      fails: true,
      why: {
        fr: 'La grille rendue est bien celle que le lecteur voit — trois colonnes à chaque ligne —, mais elle contient des valeurs que la page n’a écrites qu’une fois : « Prix » apparaît deux fois, « Lot » deux fois, « Total » trois fois. C’est le seul moyen de garder les colonnes alignées, et c’est un piège pour qui additionne une colonne sans regarder. Les répétitions sont marquées, et affichées ici entre parenthèses ; l’extrait ne les distingue pas autrement, parce que rien dans la page ne les distingue.',
        en: 'The grid returned is indeed the one the reader sees — three columns on every row — but it holds values the page wrote only once: “Prix” appears twice, “Lot” twice, “Total” three times. It is the only way to keep the columns aligned, and it is a trap for anyone adding up a column without looking. The repeats are flagged, and shown here in brackets; the snippet does not tell them apart in any other way, because nothing in the page does.',
      },
    },
  ],
};
