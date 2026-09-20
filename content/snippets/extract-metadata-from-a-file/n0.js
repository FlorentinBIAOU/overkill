/**
 * What an office document says about itself, before you send it out.
 *
 * Rung N0. A .docx, an .xlsx or a .pptx is a ZIP, and two of its entries are
 * nothing but metadata: `docProps/core.xml` carries the author, whoever saved
 * it last, the revision count and the two dates; `docProps/app.xml` carries the
 * company, the manager, the template and the total editing time. Reading them
 * is unzipping and parsing.
 *
 * The interesting part is not the reading, it is what the reading is for. A
 * document sent to a client carries the name of everyone who touched it, the
 * internal template it was built from, and how long it took. None of that is
 * visible on screen, all of it travels with the file, and it is the reason
 * this entry exists.
 *
 * One rule the code keeps. It reads two parts and it names the others: a
 * document carrying comments, tracked changes or session identifiers has more
 * to say than these two files, and answering « no author » about a document
 * whose authors are in `word/comments.xml` would be worse than saying nothing.
 * What is not read is listed, not ignored.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { strFromU8, unzipSync } from 'fflate';

// The two parts read, and the fields taken from each. The names are the local
// names of the elements: the namespaces differ between the two files and say
// nothing more than which file you are in.
export const CORE_PART = 'docProps/core.xml';
export const APP_PART = 'docProps/app.xml';
export const FIELDS = {
  title: 'title',
  creator: 'author',
  lastModifiedBy: 'last_modified_by',
  // « revision » is the number of times the document was saved, as OOXML
  // defines it — not a version number, although it is read as one.
  revision: 'revision',
  created: 'created',
  modified: 'modified',
  keywords: 'keywords',
  subject: 'subject',
  description: 'description',
  category: 'category',
  Company: 'company',
  Manager: 'manager',
  Template: 'template',
  Application: 'application',
  AppVersion: 'app_version',
  // « TotalTime » is the total editing time in minutes, as the OOXML
  // specification defines it — not a duration this code computed.
  TotalTime: 'editing_minutes',
};

// Parts that carry names, dates or identifiers this rung does not read. They
// are listed so that a quiet answer is never mistaken for an empty document.
// ECMA-376 fixes where those parts live, so the mark is only looked for inside
// those folders: a picture the author named `media/settings-du-client.png` is
// not a settings part.
const OOXML_FOLDERS = ['word/', 'xl/', 'ppt/', 'docProps/'];
const OTHER_PARTS = ['comments', 'people', 'settings', 'custom.xml', 'revisions'];

// A ZIP entry can promise far more than the archive weighs. Only the two parts
// read are decompressed, and only below this size.
export const MAX_PART_BYTES = 4_000_000;

// `htmlEntities` is what decodes « &#232; »: without it the parser leaves
// numeric character references as written, and the Python side, which decodes
// them, would not return the same author.
const PARSER = new XMLParser({
  removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false,
  trimValues: true, htmlEntities: true,
});

/**
 * The fields an OOXML document declares about itself, and what was not read.
 *
 * `data` is the bytes of the file. Nothing is written, and nothing but the two
 * metadata parts is decompressed.
 *
 * Two lists say what was not read, because a quiet answer must never pass for
 * an empty document. `other_parts` names the parts this rung does not open at
 * all — the comments, the tracked changes, the settings. `unread_parts` names
 * the ones it meant to open and could not, with why: a part whose XML is
 * malformed, and a part above the size cap. Without them, a document whose
 * `docProps/core.xml` was truncated in transit answers « no author », which is
 * the one answer this entry exists to refuse.
 *
 * `XMLValidator` is what makes the first case an answer here. `XMLParser` is
 * lenient: on a truncated part it returns an object with an empty author
 * rather than throwing, and the Python side, whose parser raises, would not
 * say the same thing.
 */
export function readDocumentMetadata(data) {
  if (!(data instanceof Uint8Array)) {
    return report(null, {}, [], `expected bytes, not ${typeof data}`);
  }
  const names = [];
  const sizes = new Map();
  let parts;
  try {
    parts = unzipSync(data, {
      filter: (file) => {
        names.push(file.name);
        sizes.set(file.name, file.originalSize);
        return (file.name === CORE_PART || file.name === APP_PART)
          && file.originalSize <= MAX_PART_BYTES;
      },
    });
  } catch {
    return report(null, {}, [], 'not a ZIP container, so not an OOXML document');
  }
  if (!names.some((name) => name.startsWith('docProps/') || name.endsWith('/document.xml'))) {
    return report(null, {}, [], 'a ZIP, but not an OOXML document');
  }

  const fields = {};
  const unread = [];
  for (const part of [CORE_PART, APP_PART]) {
    if (!names.includes(part)) continue; // the document does not carry it
    if (!parts[part]) {
      unread.push({ part, why: 'over the size cap' });
      continue;
    }
    const texteXml = strFromU8(parts[part]);
    let root;
    try {
      if (XMLValidator.validate(texteXml) !== true) throw new Error('malformed');
      const parsed = PARSER.parse(texteXml);
      // The first key is the XML declaration when the part carries one.
      root = Object.entries(parsed).find(([key]) => !key.startsWith('?'))?.[1];
    } catch {
      // A part we cannot read is a part we do not claim — and we say so.
      unread.push({ part, why: 'malformed XML' });
      continue;
    }
    for (const [local, value] of Object.entries(root ?? {})) {
      const texte = typeof value === 'object' ? '' : String(value).trim();
      if (local in FIELDS && texte) fields[FIELDS[local]] = texte;
    }
  }

  const others = names
    .filter((name) => OOXML_FOLDERS.some((folder) => name.startsWith(folder))
      && OTHER_PARTS.some((mark) => name.includes(mark))
      && name !== CORE_PART && name !== APP_PART)
    .sort();
  return report('ooxml', fields, others, null, unread);
}

function report(format, fields, otherParts, reason, unread = []) {
  return {
    format, fields, other_parts: otherParts, unread_parts: unread, reason,
  };
}
