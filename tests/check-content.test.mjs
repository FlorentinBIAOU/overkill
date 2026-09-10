/**
 * check-content doit refuser ce que le schéma Zod ne peut pas voir : un
 * fichier de code absent du disque, un extrait publié sans test, un
 * identifiant qui ne correspond pas au nom de fichier.
 *
 * Le test recopie les fixtures dans un dossier de contenu temporaire et y
 * lance le contrôle réel, plutôt que de simuler son comportement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RACINE = process.cwd();

/** Monte un dossier `content/` jetable et y lance check-content. */
function lancer(preparer) {
  const dir = mkdtempSync(join(tmpdir(), 'overkill-content-'));
  try {
    for (const d of ['entries', 'families', 'pages', 'snippets/_fixture']) {
      mkdirSync(join(dir, 'content', d), { recursive: true });
    }
    cpSync(join(RACINE, 'content/snippets/_fixture'), join(dir, 'content/snippets/_fixture'), {
      recursive: true,
    });
    preparer(dir);

    try {
      const sortie = execFileSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/check-content.mjs', `--content=${join(dir, 'content')}`],
        { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return { code: 0, sortie };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const fixture = (nom) =>
  execFileSync('cat', [join(RACINE, 'tests/fixtures/schema', nom)], { encoding: 'utf8' });

test('une fiche valide accompagnée de ses tests passe', () => {
  const r = lancer((dir) => {
    writeFileSync(join(dir, 'content/entries/fixture-valide.mdx'), fixture('valide.mdx'));
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.py'), '');
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.js'), '');
  });
  assert.equal(r.code, 0, r.sortie);
});

test('un fichier de code absent du disque est refusé', () => {
  const r = lancer((dir) => {
    writeFileSync(
      join(dir, 'content/entries/invalide-code-inexistant.mdx'),
      fixture('invalide-code-inexistant.mdx'),
    );
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.py'), '');
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.js'), '');
  });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /fichier de code introuvable/);
});

test('une fiche publiée dont un extrait n\'a pas de test est refusée', () => {
  const r = lancer((dir) => {
    writeFileSync(join(dir, 'content/entries/fixture-valide.mdx'), fixture('valide.mdx'));
    // Aucun fichier de test déposé : la règle de vérité du code doit mordre.
  });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /aucun test à côté de l'extrait/);
  assert.match(r.sortie, /CDC 4\.6/);
});

test('la même fiche en brouillon ne produit qu\'un avertissement', () => {
  const r = lancer((dir) => {
    writeFileSync(
      join(dir, 'content/entries/fixture-valide.mdx'),
      fixture('valide.mdx').replace('status: published', 'status: draft'),
    );
  });
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /avertissement/);
});

test('un nom de fichier qui ne correspond pas à l\'identifiant est refusé', () => {
  const r = lancer((dir) => {
    writeFileSync(join(dir, 'content/entries/autre-nom.mdx'), fixture('valide.mdx'));
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.py'), '');
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.js'), '');
  });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /le nom de fichier doit être/);
});

test('deux fiches partageant un identifiant sont refusées', () => {
  const r = lancer((dir) => {
    const contenu = fixture('valide.mdx');
    writeFileSync(join(dir, 'content/entries/fixture-valide.mdx'), contenu);
    writeFileSync(join(dir, 'content/entries/fixture-valide-bis.mdx'), contenu);
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.py'), '');
    writeFileSync(join(dir, 'content/snippets/_fixture/n0.test.js'), '');
  });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /identifiant déjà employé|le nom de fichier doit être/);
});

test('une famille manquante est refusée dès qu\'il y a des familles', () => {
  const r = lancer((dir) => {
    writeFileSync(
      join(dir, 'content/families/detect-filter.mdx'),
      [
        '---',
        'id: detect-filter',
        'order: 1',
        'title:',
        '  fr: "Détecter et filtrer"',
        '  en: "Detect and filter"',
        'description:',
        '  fr: "Description de la famille."',
        '  en: "Family description."',
        'question:',
        '  fr: "Question type ?"',
        '  en: "Typical question?"',
        'illustration: family-detect-filter',
        '---',
        '',
      ].join('\n'),
    );
  });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /famille absente/);
});
