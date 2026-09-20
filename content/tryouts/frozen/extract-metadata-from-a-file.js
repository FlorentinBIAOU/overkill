/**
 * Essai figé — lire ce qu'un document bureautique dit de lui-même.
 *
 * L'extrait du niveau recommandé prend des octets, pas du texte : la zone
 * d'essai du site ne peut pas lui passer un fichier. Les cinq cas ci-dessous
 * sont donc des documents fabriqués ici, à la construction du site, et lus par
 * le vrai extrait avec ses vraies dépendances. Rien n'est simulé.
 *
 * Ce qui est montré dans le champ est la liste des parties du document, parce
 * que c'est cela qu'on lit ; ce qui est calculé, c'est ce que l'extrait en
 * tire.
 */
import { strToU8, zipSync } from 'fflate';

import { readDocumentMetadata } from '../../snippets/extract-metadata-from-a-file/n0.js';

// données-fictives:début — un contrat fabriqué pour cette page, avec des noms
// et une entreprise inventés : ce sont les données que l'extrait lit.
const CORE = `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
<dc:title>Contrat de prestation</dc:title>
<dc:creator>Marie Martin</dc:creator>
<cp:lastModifiedBy>Jean Dupont</cp:lastModifiedBy>
<cp:revision>7</cp:revision>
<dcterms:created>2026-09-14T09:12:00Z</dcterms:created>
<dcterms:modified>2026-10-10T13:55:00Z</dcterms:modified>
</cp:coreProperties>`;

const APP = `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Microsoft Office Word</Application>
<Company>Cabinet Lumi&#232;re</Company>
<Manager>Claire Bernard</Manager>
<Template>contrat-interne.dotx</Template>
<TotalTime>413</TotalTime>
</Properties>`;
// données-fictives:fin

const TYPES = '<?xml version="1.0" encoding="UTF-8"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
const DOC = '<?xml version="1.0" encoding="UTF-8"?><w:document '
  + 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>';

const PARTIES = {
  '[Content_Types].xml': TYPES,
  'docProps/core.xml': CORE,
  'docProps/app.xml': APP,
  'word/document.xml': DOC,
  'word/comments.xml': '<comments/>',
  'word/people.xml': '<people/>',
  'word/settings.xml': '<settings/>',
  'lisezmoi.txt': 'ceci nest pas un document',
};

const NOMS = {
  fr: {
    title: 'Titre', author: 'Auteur', last_modified_by: 'Dernier enregistrement',
    revision: 'Révision', created: 'Créé le', modified: 'Modifié le',
    company: 'Entreprise', manager: 'Responsable', template: 'Modèle',
    editing_minutes: 'Temps d’édition (minutes)', application: 'Logiciel',
    keywords: 'Mots-clés', app_version: 'Version du logiciel',
  },
  en: {
    title: 'Title', author: 'Author', last_modified_by: 'Last saved by',
    revision: 'Revision', created: 'Created', modified: 'Modified',
    company: 'Company', manager: 'Manager', template: 'Template',
    editing_minutes: 'Editing time (minutes)', application: 'Application',
    keywords: 'Keywords', app_version: 'Application version',
  },
};

const T = {
  fr: {
    colonnes: ['Champ', 'Ce que le document déclare'],
    lu: (n) => `${n} champ(s) lus dans les deux parties de métadonnées`,
    rien: 'Aucune métadonnée déclarée',
    autres: (parts) => `Parties non lues, qui portent aussi des noms ou des identifiants : ${parts.join(', ')}.`,
    refus: 'Ce fichier n’est pas un document bureautique',
  },
  en: {
    colonnes: ['Field', 'What the document declares'],
    lu: (n) => `${n} field(s) read across the two metadata parts`,
    rien: 'No metadata declared',
    autres: (parts) => `Parts not read, which also carry names or identifiers: ${parts.join(', ')}.`,
    refus: 'This file is not an office document',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Le document est fabriqué ici, à la construction du site, puis lu par l’extrait tel quel. Rien n’est envoyé nulle part, et le champ ci-dessus montre les parties du fichier ZIP, qui est ce qu’un .docx est.',
    en: 'The document is built here, when the site is built, then read by the snippet as it is. Nothing is sent anywhere, and the field above shows the parts of the ZIP file, which is what a .docx is.',
  },

  run(input, lang) {
    const t = T[lang];
    const choisies = input.split('\n').map((l) => l.trim()).filter(Boolean);
    const entrees = {};
    for (const nom of choisies) {
      if (PARTIES[nom]) entrees[nom] = strToU8(PARTIES[nom]);
    }
    const rapport = readDocumentMetadata(zipSync(entrees));
    if (rapport.reason) return { verdict: { label: t.refus, detail: rapport.reason } };

    const lignes = Object.entries(rapport.fields)
      .map(([cle, valeur]) => [NOMS[lang][cle] ?? cle, { v: valeur, caught: true }]);
    return {
      rows: { columns: t.colonnes, rows: lignes },
      verdict: {
        label: lignes.length ? t.lu(lignes.length) : t.rien,
        detail: rapport.other_parts.length ? t.autres(rapport.other_parts) : undefined,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Un contrat prêt à partir', en: 'A contract ready to go out' },
      input: '[Content_Types].xml\ndocProps/core.xml\ndocProps/app.xml\nword/document.xml',
    },
    {
      label: { fr: 'Le même, sans la partie « application »', en: 'The same, without the application part' },
      input: '[Content_Types].xml\ndocProps/core.xml\nword/document.xml',
    },
    {
      label: { fr: 'Un document dont les métadonnées ont été retirées', en: 'A document whose metadata was removed' },
      input: '[Content_Types].xml\nword/document.xml',
    },
    {
      label: { fr: 'Un fichier ZIP qui n’est pas un document', en: 'A ZIP file that is not a document' },
      input: 'lisezmoi.txt',
    },
    {
      label: { fr: 'Le contrat, avec ses commentaires et ses réglages', en: 'The contract, with its comments and settings' },
      input: '[Content_Types].xml\ndocProps/core.xml\ndocProps/app.xml\nword/document.xml\n'
        + 'word/comments.xml\nword/people.xml\nword/settings.xml',
      fails: true,
      why: {
        fr: 'Les champs lus sont les mêmes que dans le premier cas, et pourtant ce document en dit beaucoup plus : les commentaires portent le nom de qui les a écrits et la date, `word/people.xml` la liste des relecteurs, et `word/settings.xml` des identifiants de session qui relient entre elles les versions d’un même fichier. Ce niveau ne lit pas ces parties — il les nomme, sous le tableau. C’est la seule façon honnête de répondre : dire « voici les métadonnées » en s’arrêtant à deux fichiers laisserait croire qu’il n’y a rien d’autre.',
        en: 'The fields read are the same as in the first case, and yet this document says a great deal more: the comments carry the name of whoever wrote them and the date, `word/people.xml` the list of reviewers, and `word/settings.xml` session identifiers that tie together the versions of one file. This level does not read those parts — it names them, under the table. That is the only honest answer: saying “here is the metadata” while stopping at two files would suggest there is nothing else.',
      },
    },
  ],
};
