/**
 * Le schéma doit accepter une fiche conforme et rejeter chaque violation des
 * contraintes de la section 5.2 du cahier des charges.
 *
 * Les fixtures vivent sous tests/fixtures/, hors des collections : une fiche
 * volontairement invalide ne doit pas casser le build du site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

import { entrySchema } from '../src/content/schema/entry.ts';
import { familySchema } from '../src/content/schema/family.ts';
import { roadmapItemSchema } from '../src/content/schema/roadmap.ts';

const DIR = 'tests/fixtures/schema';

const frontmatter = (fichier) => matter(readFileSync(join(DIR, fichier), 'utf8')).data;

/** Ce que chaque fixture invalide doit faire échouer, et sur quel champ. */
const REJETS = {
  'invalide-verdict-barreau-absent': 'verdict',
  'invalide-cout-hors-vocabulaire': 'cost',
  'invalide-latence-hors-classes': 'latency',
  'invalide-langue-manquante': 'en',
  'invalide-barreau-sans-raison': 'unavailable_reason',
  'invalide-date-future': 'updated',
  'invalide-barreaux-desordre': 'rungs',
};

test('une fiche conforme est acceptée', () => {
  const r = entrySchema.safeParse(frontmatter('valide.mdx'));
  assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues, null, 2));
});

for (const [nom, champ] of Object.entries(REJETS)) {
  test(`fiche rejetée : ${nom}`, () => {
    const r = entrySchema.safeParse(frontmatter(`${nom}.mdx`));
    assert.equal(r.success, false, `${nom} aurait dû être rejetée`);

    const chemins = r.error.issues.flatMap((i) => i.path.map(String));
    const messages = r.error.issues.map((i) => i.message).join(' | ');
    assert.ok(
      chemins.includes(champ) || messages.includes(champ),
      `le message d'erreur doit nommer « ${champ} », obtenu : ${messages}`,
    );
  });
}

test('toutes les fixtures invalides du dossier sont couvertes par un test', () => {
  const presentes = readdirSync(DIR)
    .filter((f) => f.startsWith('invalide-') && f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''));

  // La fixture au fichier de code inexistant relève de check-content, pas de
  // Zod : le schéma ne voit pas le disque. Elle est testée ailleurs.
  const horsZod = new Set(['invalide-code-inexistant']);
  const attendues = new Set([...Object.keys(REJETS), ...horsZod]);

  for (const nom of presentes) {
    assert.ok(attendues.has(nom), `fixture ${nom} sans test associé`);
  }
  assert.equal(presentes.length, attendues.size);
});

test('le schéma de famille exige les dix identifiants connus', () => {
  const ok = familySchema.safeParse({
    id: 'detect-filter',
    order: 1,
    title: { fr: 'Détecter et filtrer', en: 'Detect and filter' },
    description: { fr: 'Description.', en: 'Description.' },
    question: { fr: 'Question ?', en: 'Question?' },
    illustration: 'family-detect-filter',
  });
  assert.equal(ok.success, true);

  const ko = familySchema.safeParse({
    id: 'inventee',
    order: 1,
    title: { fr: 'a', en: 'b' },
    description: { fr: 'a', en: 'b' },
    question: { fr: 'a', en: 'b' },
    illustration: 'x',
  });
  assert.equal(ko.success, false);
});

test("un intitulé de feuille de route exige ses deux langues", () => {
  const ko = roadmapItemSchema.safeParse({
    id: 'un-intitule',
    family: 'extract',
    title: { fr: 'Titre' },
    need: { fr: 'Besoin.', en: 'Need.' },
  });
  assert.equal(ko.success, false);
});
