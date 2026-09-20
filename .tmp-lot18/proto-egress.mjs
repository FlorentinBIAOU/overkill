import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const SIGNES = [
  { nom: 'adresse HTTP', motif: /https?:\/\/[^\s'"`)]+/ },
  { nom: 'urllib.request', motif: /\bimport\s+urllib\.request\b|\bfrom\s+urllib\s+import\s+request\b|\burllib\.request\./ },
  { nom: 'requests', motif: /\bimport\s+requests\b/ },
  { nom: 'httpx', motif: /\bimport\s+httpx\b/ },
  { nom: 'fetch', motif: /\bfetch\s*\(/ },
  { nom: 'http.client', motif: /\bimport\s+http\.client\b/ },
  { nom: 'socket', motif: /\bimport\s+socket\b/ },
  { nom: 'client de fournisseur', motif: /ProviderClient\s*\(|providerClient\s*\(/ },
];

const noms = (await readdir('content/entries')).filter(f=>f.endsWith('.mdx')&&!f.startsWith('_'));
for (const nom of noms) {
  const { data } = matter(await readFile(join('content/entries', nom),'utf8'));
  if (data.status !== 'published') continue;
  for (const r of data.rungs ?? []) {
    if (!r.available || r.risks?.data_egress !== 'none') continue;
    for (const [langue, chemin] of Object.entries(r.code ?? {})) {
      if (langue === 'verification' || typeof chemin !== 'string') continue;
      const p = join('content', chemin);
      if (!existsSync(p)) continue;
      const src = await readFile(p, 'utf8');
      for (const s of SIGNES) {
        const m = src.match(s.motif);
        if (m) console.log(`${data.id} ${r.level} ${chemin}  [${s.nom}] ${m[0].slice(0,70)}`);
      }
    }
  }
}
