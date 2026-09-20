/**
 * Essai figé — vérifier qu'un fichier est bien du type annoncé.
 *
 * Figé pour deux raisons : l'extrait du niveau recommandé s'appuie sur
 * `file-type`, un paquet installé, et l'entrée n'est pas du texte mais des
 * octets — un champ de saisie ne sert à rien ici. Les sorties sont calculées à
 * la construction du site, en exécutant le vrai extrait sur les octets
 * ci-dessous, fabriqués pour cette page.
 *
 * Chaque cas se présente comme un téléversement : le client annonce un nom de
 * fichier, le code lit les octets, et le verdict dit si les deux concordent.
 */
import { sniffFile } from '../../snippets/check-a-file-is-really-the-format-it-claims/n0.js';

const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
const texte = (s) => new TextEncoder().encode(s);
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const joindre = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

/* Des fichiers minimaux, fabriqués pour cette page : aucun n'est le fichier de
   quelqu'un, et tous sont de vrais fichiers de leur format. */
const PNG = joindre(
  hex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'),
  new Uint8Array(20),
);
const ZIP = b64(
  'UEsDBBQAAAAIAEMhNF3I8LalCQAAAAcAAAAJAAAAbm90ZXMudHh0S8rPy8ovLQIAUEsBAhQDFAAAAAgAQyE0Xc'
  + 'jwtqUJAAAABwAAAAkAAAAAAAAAAAAAAIABAAAAAG5vdGVzLnR4dFBLBQYAAAAAAQABADcAAAAwAAAAAAA=');
const DOCX = b64(
  'UEsDBBQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2Puw7CMAxFf6XKihoXBg'
  + 'aUlIEdGPgBK3HbiOahJBT4exKQOjBax/dcWxxfdm4Wisl4J9mWd+zYi9s7UGoKcUmyKedwAEhqIouJ+0CukMFH'
  + 'i7mMcYSA6o4jwa7r9qC8y+Rym6uD9eJS5NFoaq4Y8xktSQZPHzVorx62bPJiY83pF6vNkmEIs1GYy02wOP3X2f'
  + 'phMIrWfLWF6BWlZNxoZ74Si8Ztqh56Ad+n+g9QSwMEFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAB3b3JkL2Rv'
  + 'Y3VtZW50LnhtbLMpt0rJTy7NTc0r0bcDAFBLAQIUAxQAAAAIAEMhNF3GEnoHrAAAAPEAAAATAAAAAAAAAAAAAA'
  + 'CAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAQyE0Xd1ahg0PAAAADQAAABEAAAAAAAAAAAAA'
  + 'AIAB3QAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAABsBAAAAAA==');
const CSV = texte('nom;prenom;ville\nDupont;Jean;Boulogne-Billancourt\n');

const OCTETS = { PNG, ZIP, DOCX, CSV, 'PNG+ZIP': joindre(PNG, ZIP) };
const AUTORISES = ['png', 'jpg', 'pdf'];

const T = {
  fr: {
    ok: (t) => `Accepté — ${t}`,
    mismatch: (lu, dit) => `Refusé — les octets disent ${lu}, le nom dit ${dit}`,
    horsListe: (t) => `Refusé — ${t} n’est pas dans la liste autorisée`,
    inconnu: 'Refusé — aucune signature lue dans les octets',
    autorise: `Le type lu est dans la liste autorisée (${AUTORISES.join(', ')}).`,
    interdit: (t) => `Le type lu, ${t}, n’est pas dans la liste autorisée (${AUTORISES.join(', ')}).`,
  },
  en: {
    ok: (t) => `Accepted — ${t}`,
    mismatch: (lu, dit) => `Refused — the bytes say ${lu}, the name says ${dit}`,
    horsListe: (t) => `Refused — ${t} is not on the allow list`,
    inconnu: 'Refused — no signature read from the bytes',
    autorise: `The type read is on the allow list (${AUTORISES.join(', ')}).`,
    interdit: (t) => `The type read, ${t}, is not on the allow list (${AUTORISES.join(', ')}).`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Chaque cas est un téléversement : un nom de fichier annoncé par le client, et des octets. Les sorties sont celles de l’extrait, exécutées à la construction du site.',
    en: 'Each case is an upload: a file name the client claims, and some bytes. The outputs are the snippet’s own, run when the site is built.',
  },

  async run(input, lang, cas) {
    const t = T[lang];
    const octets = OCTETS[cas?.octets ?? 'PNG'];
    const rapport = await sniffFile(octets, { claimedName: input, allowed: AUTORISES });
    let label = t.inconnu;
    if (rapport.matches_claim === false) {
      label = t.mismatch(rapport.detected, rapport.claimed);
    } else if (rapport.detected !== null) {
      label = rapport.allowed ? t.ok(rapport.detected) : t.horsListe(rapport.detected);
    }
    return {
      verdict: {
        label,
        detail: rapport.allowed ? t.autorise : rapport.detected ? t.interdit(rapport.detected) : t.inconnu,
      },
      output: JSON.stringify(rapport, null, 2),
    };
  },

  cases: [
    {
      label: { fr: 'Une vraie image, annoncée comme telle', en: 'A real image, claimed as one' },
      input: 'photo-de-profil.png',
      octets: 'PNG',
      shown: { fr: 'photo-de-profil.png — 48 octets commençant par 89 50 4E 47', en: 'photo-de-profil.png — 48 bytes starting with 89 50 4E 47' },
    },
    {
      label: { fr: 'Une archive renommée en image', en: 'An archive renamed as an image' },
      input: 'photo-de-profil.png',
      octets: 'ZIP',
      shown: { fr: 'photo-de-profil.png — une archive ZIP, commençant par 50 4B', en: 'photo-de-profil.png — a ZIP archive, starting with 50 4B' },
    },
    {
      label: { fr: 'Un document Word, reconnu en ouvrant l’archive', en: 'A Word document, recognised by opening the archive' },
      input: 'contrat.docx',
      octets: 'DOCX',
      shown: { fr: 'contrat.docx — une archive ZIP qui contient word/document.xml', en: 'contrat.docx — a ZIP archive holding word/document.xml' },
    },
    {
      label: { fr: 'Une image valide qui porte une archive collée derrière', en: 'A valid image with an archive stuck behind it' },
      input: 'photo-de-profil.png',
      octets: 'PNG+ZIP',
      shown: { fr: 'photo-de-profil.png — un PNG suivi d’une archive ZIP', en: 'photo-de-profil.png — a PNG followed by a ZIP archive' },
      fails: true,
      why: {
        fr: 'Le fichier est accepté : ses premiers octets sont bien ceux d’un PNG, et c’est la règle — la signature est en tête. Le reste du fichier n’est pas lu, et un polyglotte passe donc comme son format d’ouverture ; c’est à votre traitement d’aval, pas à cette lecture, de décider ce qu’il fait des octets qui suivent.',
        en: 'The file is accepted: its first bytes really are a PNG’s, and that is the rule — the signature comes first. The rest of the file is not read, so a polyglot passes as its leading format; what to do with the bytes that follow is for your downstream processing to decide, not for this read.',
      },
    },
    {
      label: { fr: 'Un export de tableur en CSV', en: 'A spreadsheet export as CSV' },
      input: 'clients.csv',
      octets: 'CSV',
      shown: { fr: 'clients.csv — du texte, sans aucun en-tête binaire', en: 'clients.csv — text, with no binary header at all' },
      fails: true,
      why: {
        fr: 'Aucune signature à lire : un CSV est du texte, et la table ne connaît que des en-têtes binaires. Le fichier revient non reconnu, donc non autorisé — ce qui est le bon défaut, mais ce qui veut aussi dire que ce contrôle ne sait rien dire des formats texte, CSV, JSON, SVG et HTML compris.',
        en: 'There is no signature to read: a CSV is text, and the table only knows binary headers. The file comes back unrecognised, so not allowed — which is the right default, and also means this check has nothing to say about text formats, CSV, JSON, SVG and HTML included.',
      },
    },
  ],
};
