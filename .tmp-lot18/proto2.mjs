import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CLES = ['reason', 'why', 'evidence', 'skipped', 'source', 'strategy'];
const CLE = new RegExp(`^(?:${CLES.join('|')})$`);

/** Masque commentaires et docstrings, garde les positions (remplace par des espaces). */
function nettoyer(src, py) {
  const out = src.split('');
  let i = 0;
  while (i < src.length) {
    if (py && src[i] === '#') { while (i < src.length && src[i] !== '\n') { out[i]=' '; i++; } continue; }
    if (!py && src[i] === '/' && src[i+1] === '/') { while (i < src.length && src[i] !== '\n') { out[i]=' '; i++; } continue; }
    if (!py && src[i] === '/' && src[i+1] === '*') { const e = src.indexOf('*/', i+2); const end = e<0?src.length:e+2; for(;i<end;i++) if(src[i]!=='\n') out[i]=' '; continue; }
    if (py) { const t = src.slice(i,i+3); if (t==='"""'||t==="'''") { const e = src.indexOf(t,i+3); const end=e<0?src.length:e+3; for(;i<end;i++) if(src[i]!=='\n') out[i]=' '; continue; } }
    if (src[i] === '"' || src[i] === "'" || (!py && src[i]==='`')) { const q=src[i]; i++; while(i<src.length && src[i]!==q){ if(src[i]==='\\') i++; i++; } i++; continue; }
    i++;
  }
  return out.join('');
}

/** Toutes les chaînes littérales, avec leur position. */
function litteraux(src, py) {
  const res = []; let i = 0;
  const masque = nettoyer(src, py); // pour savoir où sont les commentaires
  while (i < src.length) {
    if (masque[i] === ' ' && src[i] !== ' ' && src[i] !== '\n' && !/["'`]/.test(src[i])) { i++; continue; }
    const c = src[i];
    if ((c==='"'||c==="'"||(!py&&c==='`')) && masque.slice(Math.max(0,i-1),i+1) !== '  ') {
      // vérifier que ce n'est pas dans un commentaire : masque[i] vaut ' ' si commenté
      if (masque[i] === ' ' && src[i] !== ' ') { i++; continue; }
      if (py) { const t = src.slice(i,i+3); if (t==='"""'||t==="'''") { const e=src.indexOf(t,i+3); i = e<0?src.length:e+3; continue; } }
      let j=i+1, buf='';
      while (j<src.length && src[j]!==c) { if (src[j]==='\\'){buf+=src[j+1];j+=2;continue;} buf+=src[j]; j++; }
      res.push({ debut: i, fin: j, valeur: buf });
      i=j+1; continue;
    }
    i++;
  }
  return res;
}

const estPhrase = (s) => {
  const t = s.replace(/\$\{[^}]*\}|\{[^}]*\}/g, ' ').trim();
  const mots = t.split(/\s+/).filter(Boolean);
  return t.length >= 12 && mots.length >= 3 && (t.match(/[\p{L} ]/gu)||[]).length / t.length > 0.7;
};

/** Noms de fonctions dont un paramètre est une clé de raison, avec l'index. */
function porteurs(propre, py) {
  const map = new Map();
  const defs = py
    ? [...propre.matchAll(/def\s+(\w+)\s*\(([^)]*)\)/g)]
    : [...propre.matchAll(/(?:function\s+(\w+)\s*\(([^)]*)\)|(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>)/g)];
  for (const m of defs) {
    const nom = m[1] ?? m[3], params = (m[2] ?? m[4] ?? '');
    if (!nom) continue;
    const idx = [];
    params.split(',').forEach((p, k) => {
      const n = p.trim().replace(/[:=].*$/, '').replace(/^\*+/, '').trim();
      if (CLE.test(n)) idx.push(k);
    });
    if (idx.length) map.set(nom, idx);
  }
  return map;
}

/** Découpe les arguments d'un appel à partir de la parenthèse ouvrante. */
function args(src, ouvre) {
  let depth = 0, i = ouvre, debut = ouvre+1; const out = [];
  while (i < src.length) {
    const c = src[i];
    if (c==='"'||c==="'"||c==='`') { const q=c; i++; while(i<src.length&&src[i]!==q){ if(src[i]==='\\')i++; i++; } i++; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { depth--; if (!depth) { out.push([debut, i]); return out; } }
    else if (c===',' && depth===1) { out.push([debut, i]); debut = i+1; }
    i++;
  }
  return out;
}

function raisons(src, py) {
  const propre = nettoyer(src, py);
  const lits = litteraux(src, py).filter(l => estPhrase(l.valeur));
  const trouve = new Set();
  const marque = (l) => trouve.add(l.valeur);

  // 1. clé : valeur / clé = valeur
  for (const l of lits) {
    const avant = propre.slice(Math.max(0, l.debut - 40), l.debut);
    if (new RegExp(`["'\`]?\\b(?:${CLES.join('|')})["'\`]?\\s*[:=]\\s*(?:f|r)?$`).test(avant)) marque(l);
  }
  // 2. appels aux porteurs
  const p = porteurs(propre, py);
  for (const [nom, idx] of p) {
    for (const m of propre.matchAll(new RegExp(`\\b${nom}\\s*\\(`, 'g'))) {
      const ouvre = m.index + m[0].length - 1;
      const a = args(src, ouvre);
      for (const k of idx) {
        if (!a[k]) continue;
        const [d, f] = a[k];
        for (const l of lits) if (l.debut >= d && l.fin <= f) marque(l);
      }
    }
  }
  return trouve;
}

const racine = 'content/snippets';
let total=0, absentes=0; const parFiche={};
for (const id of (await readdir(racine,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.name.startsWith('_')).map(e=>e.name)) {
  const fichiers = await readdir(join(racine,id));
  const tests = (await Promise.all(fichiers.filter(f=>/\.test\.(py|js)$/.test(f)).map(f=>readFile(join(racine,id,f),'utf8')))).join('\n');
  for (const f of fichiers.filter(f=>/^n\d\.(py|js)$/.test(f))) {
    const src = await readFile(join(racine,id,f),'utf8');
    for (const v of raisons(src, f.endsWith('.py'))) {
      total++;
      const noyau = v.split(/\$\{[^}]*\}|\{[^}]*\}/).map(x=>x.trim()).filter(x=>x.length>=12).sort((a,b)=>b.length-a.length)[0];
      if (!noyau) continue;
      if (!tests.includes(noyau)) { absentes++; (parFiche[id]??=[]).push(`${f}: ${v.slice(0,80)}`); }
    }
  }
}
console.log(`raisons ${total}, absentes ${absentes}, fiches ${Object.keys(parFiche).length}`);
for (const [id,l] of Object.entries(parFiche)) { console.log('\n## '+id); l.slice(0,8).forEach(x=>console.log('   '+x)); if(l.length>8)console.log(`   … ${l.length-8}`); }
