/**
 * La substitution de docstring d'en-tête.
 *
 * Ce que ces contrôles démontrent : la traduction remplace le premier bloc de
 * commentaire, respecte la forme du langage, et ne touche à rien d'autre. Le
 * dernier point est le seul qui compte vraiment — le lecteur français doit voir
 * le même code que le lecteur anglais.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  corpsApresDoc,
  docTraduite,
  readSnippet,
  replaceHeaderDoc,
} from '../src/lib/snippets.ts';

const PY = `"""
Mask personal data.

Rung N0. Deterministic.
"""

import re

# The space characters French typography puts inside numbers.
UNUSUAL = re.compile(r"[ ]")
`;

const JS = `/**
 * Mask personal data.
 *
 * Rung N0. Deterministic.
 */

// The space characters French typography puts inside numbers.
const UNUSUAL = / /g;
`;

test('la docstring Python est remplacée, le code ne bouge pas', () => {
  const rendu = replaceHeaderDoc(PY, 'python', 'Masquer les coordonnées.\n\nNiveau N0. Déterministe.');
  assert.match(rendu, /^"""\nMasquer les coordonnées\.\n\nNiveau N0\. Déterministe\.\n"""/);
  assert.equal(corpsApresDoc(rendu, 'python'), corpsApresDoc(PY, 'python'));
  // Le commentaire en ligne reste en anglais (décisions de clarté, section 1).
  assert.match(rendu, /# The space characters French typography puts inside numbers\./);
});

test('la docstring JavaScript est remplacée avec ses étoiles', () => {
  const rendu = replaceHeaderDoc(JS, 'javascript', 'Masquer les coordonnées.\n\nNiveau N0. Déterministe.');
  assert.match(rendu, /^\/\*\*\n \* Masquer les coordonnées\.\n \*\n \* Niveau N0\. Déterministe\.\n \*\//);
  assert.equal(corpsApresDoc(rendu, 'javascript'), corpsApresDoc(JS, 'javascript'));
  assert.match(rendu, /const UNUSUAL = \/ \/g;/);
});

test('un extrait sans docstring d’en-tête est rendu tel quel', () => {
  const sans = 'const x = 1;\n';
  assert.equal(replaceHeaderDoc(sans, 'javascript', 'Traduction'), sans);
});

test('la langue anglaise ne cherche aucune traduction', () => {
  assert.equal(docTraduite('snippets/mask-personal-data-in-chat/n0.py', 'en'), undefined);
});

test('sur un extrait réel, seule la docstring change', () => {
  const chemin = 'snippets/mask-personal-data-in-chat/n0.py';
  const disque = readFileSync(`content/${chemin}`, 'utf8');
  const fr = readSnippet(chemin, 'python', 'fr');
  const en = readSnippet(chemin, 'python', 'en');

  assert.equal(fr.translated, true);
  assert.equal(en.translated, false);
  assert.equal(en.code, disque.replace(/\s+$/, ''));
  assert.notEqual(fr.code, en.code);
  assert.equal(corpsApresDoc(fr.code, 'python'), corpsApresDoc(en.code, 'python'));
});
