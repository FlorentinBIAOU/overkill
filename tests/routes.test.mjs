/**
 * Le sélecteur de langue doit conserver la page courante (CDC 9.3). C'est une
 * règle simple à énoncer et facile à casser : elle se teste.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, switchLocale, localeOf, SEGMENTS } from '../src/i18n/routes.ts';

test('les routes se construisent avec le préfixe de langue', () => {
  assert.equal(route('fr', 'catalogue'), '/fr/catalogue');
  assert.equal(route('en', 'catalogue'), '/en/catalogue');
  assert.equal(route('fr', 'entries', 'mask-personal-data-in-chat'), '/fr/fiches/mask-personal-data-in-chat');
  assert.equal(route('en', 'families', 'detect-filter'), '/en/familles/detect-filter');
  assert.equal(route('fr', 'home'), '/fr');
});

test("le changement de langue conserve la page, y compris sur une fiche", () => {
  assert.equal(switchLocale('/fr/fiches/extract-dates-from-text', 'en'), '/en/fiches/extract-dates-from-text');
  assert.equal(switchLocale('/en/familles/search', 'fr'), '/fr/familles/search');
  assert.equal(switchLocale('/fr/catalogue', 'en'), '/en/catalogue');
  assert.equal(switchLocale('/en', 'fr'), '/fr');
});

test('un chemin sans préfixe de langue mène à la racine de la langue visée', () => {
  assert.equal(switchLocale('/', 'fr'), '/fr');
  assert.equal(switchLocale('/quelque-chose', 'en'), '/en');
});

test('la locale se lit dans le chemin', () => {
  assert.equal(localeOf('/fr/catalogue'), 'fr');
  assert.equal(localeOf('/en'), 'en');
  assert.equal(localeOf('/'), undefined);
  assert.equal(localeOf('/de/catalogue'), undefined);
});

test('les segments de premier niveau sont tous déclarés', () => {
  /*
   * La section 7.1 du CDC en donnait douze. La feuille de route publique en a
   * été retirée au lot 14 : le document la comptait parmi les décisions
   * périmées, la navigation ne la porte plus, et les deux cents intitulés
   * restent un document de travail du dépôt, pas une page.
   */
  const attendus = [
    '', 'catalogue', 'familles', 'fiches', 'methodologie', 'par-ou-commencer',
    'dernieres-fiches',
    'a-propos', 'contribuer', 'accompagnement', 'mentions-legales',
    'confidentialite', 'credits',
  ];
  assert.deepEqual(Object.values(SEGMENTS).sort(), attendus.sort());
});
