import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// --- scanner JS (chaînes hors commentaires et hors littéraux d'expression régulière)
function chainesJs(src) {
  const out = [];
  let i = 0, prev = '';
  const isRegexPos = () => /(?:[(,=:[!&|?{};]|=>|\breturn|\btypeof|\bcase)$/.test(prev.trimEnd()) || prev.trim() === '';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i+1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i+1] === '*') { i = src.indexOf('*/', i+2); i = i < 0 ? src.length : i+2; continue; }
    if (c === '/' && isRegexPos()) {
      let j = i+1, klass = false;
      while (j < src.length) { const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') klass = true; else if (d === ']') klass = false;
        else if (d === '/' && !klass) break; else if (d === '\n') break;
        j++; }
      prev += src.slice(i, j+1); i = j+1; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i+1, buf = '';
      while (j < src.length) { const d = src[j];
        if (d === '\\') { buf += src[j+1]; j += 2; continue; }
        if (d === c) break;
        if (c === '`' && d === '$' && src[j+1] === '{') { // interpolation : on coupe
          let depth = 1; j += 2; while (j < src.length && depth) { if (src[j]==='{')depth++; if (src[j]==='}')depth--; j++; }
          buf += '\u0000'; continue; }
        buf += d; j++; }
      out.push(buf); prev += ' "" '; i = j+1; continue;
    }
    prev += c; if (prev.length > 40) prev = prev.slice(-40);
    i++;
  }
  return out;
}

// --- scanner Python (hors commentaires, hors triples quotes = docstrings)
function chainesPy(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    const triple = src.slice(i, i+3);
    if (triple === '"""' || triple === "'''") {
      const end = src.indexOf(triple, i+3); i = end < 0 ? src.length : end+3; continue;
    }
    if (c === '"' || c === "'") {
      let j = i+1, buf = '';
      while (j < src.length) { const d = src[j];
        if (d === '\\') { buf += src[j+1]; j += 2; continue; }
        if (d === c) break;
        if (d === '{' && src[j+1] !== '{') { let depth=1; j++; while (j<src.length && depth){ if(src[j]==='{')depth++; if(src[j]==='}')depth--; j++; } buf += '\u0000'; continue; }
        buf += d; j++; }
      out.push(buf); i = j+1; continue;
    }
    i++;
  }
  return out;
}

const estPhrase = (s) => {
  const t = s.replace(/\u0000/g, ' ').trim();
  if (t.length < 12) return false;
  const mots = t.split(/\s+/).filter(Boolean);
  if (mots.length < 3) return false;
  if (!/^[\p{L}«"'(\u0000]/u.test(t)) return false;
  const lettres = (t.match(/[\p{L} ]/gu) || []).length;
  return lettres / t.length > 0.7;
};

const racine = 'content/snippets';
let total = 0, manquantes = 0; const parFiche = {};
for (const id of (await readdir(racine, { withFileTypes: true })).filter(e=>e.isDirectory()&&!e.name.startsWith('_')).map(e=>e.name)) {
  const fichiers = await readdir(join(racine, id));
  const tests = (await Promise.all(fichiers.filter(f=>/\.test\.(py|js)$/.test(f)).map(f=>readFile(join(racine,id,f),'utf8')))).join('\n');
  for (const f of fichiers.filter(f=>/^n\d\.(py|js)$/.test(f))) {
    const src = await readFile(join(racine,id,f),'utf8');
    const ch = f.endsWith('.py') ? chainesPy(src) : chainesJs(src);
    for (const s of new Set(ch.filter(estPhrase))) {
      total++;
      const noyau = s.split('\u0000').map(x=>x.trim()).filter(x=>x.length>=12).sort((a,b)=>b.length-a.length)[0];
      if (!noyau) continue;
      if (!tests.includes(noyau)) { manquantes++; (parFiche[id] ??= []).push(`${f}: ${s.slice(0,90)}`); }
    }
  }
}
console.log(`phrases ${total}, absentes des tests ${manquantes}, fiches ${Object.keys(parFiche).length}`);
for (const [id, l] of Object.entries(parFiche)) { console.log('\n## '+id); for (const x of l.slice(0,6)) console.log('   '+x); if(l.length>6) console.log(`   … ${l.length-6} de plus`); }
