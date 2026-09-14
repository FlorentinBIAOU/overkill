#!/usr/bin/env node
/**
 * Le responsive, vérifié sur les pages réelles (CDC 8.7, lot 14 partie 9.2).
 *
 * Deux choses à la fois, parce qu'elles se constatent dans le même navigateur
 * et aux mêmes largeurs :
 *
 *   1. **Aucun débordement horizontal**, jusqu'à 360 px de large. Un contenu
 *      large — tableau, bloc de code — a le droit de défiler dans son propre
 *      conteneur ; c'est la page qui n'a pas le droit de déborder. Le contrôle
 *      ignore donc ce qui vit dans un conteneur défilant, et ne retient que ce
 *      qui pousse réellement le document.
 *
 *   2. **La taille des cibles tactiles.** Tout élément interactif visible doit
 *      faire au moins 44 px dans les deux dimensions, ce qui est le plancher
 *      que le site s'est donné et qui dépasse le minimum de la norme. Sont
 *      exemptés les liens posés dans une phrase — leur cible est la ligne de
 *      texte, et les agrandir casserait l'interligne — ainsi que ce qui est
 *      masqué.
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';

const LARGEURS = [360, 600, 900, 1440];

const pages = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (pages.length === 0) {
  console.error('usage : node scripts/check-overflow.mjs <chemin> [chemin...]');
  process.exit(1);
}

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
let echecs = 0;

for (const chemin of pages) {
  for (const largeur of LARGEURS) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
    await page.goto(base + chemin, { waitUntil: 'networkidle' });

    const resultat = await page.evaluate(() => {
      const racine = document.documentElement;
      const limite = racine.clientWidth;
      if (racine.scrollWidth <= limite) return { deborde: false, coupables: [] };

      /** Un ancêtre qui défile absorbe la largeur de ses enfants. */
      const dansUnConteneurDefilant = (el) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
        }
        return false;
      };

      const coupables = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= limite + 1) continue;
        if (dansUnConteneurDefilant(el)) continue;
        coupables.push(
          `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
            `${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}` +
            ` (droite ${Math.round(r.right)} px)`,
        );
      }
      return { deborde: coupables.length > 0, largeurDocument: racine.scrollWidth, coupables: [...new Set(coupables)].slice(0, 8) };
    });

    /*
     * Les cibles tactiles. Mesurées une seule fois par page, à la plus petite
     * largeur : c'est là que les éléments se resserrent, et un bouton qui
     * passe à 360 px passe partout.
     */
    const cibles =
      largeur === LARGEURS[0]
        ? await page.evaluate(() => {
            const CIBLE = 44;
            /* `[tabindex="-1"]` désigne une cible de focus programmatique — un
               titre d'écran vers lequel on renvoie l'attention — pas un objet
               que l'on touche. */
            const interactifs =
              'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex^="-"])';
            const petites = [];
            for (const el of document.querySelectorAll(interactifs)) {
              if (el.closest('[hidden]') || el.hasAttribute('hidden')) continue;
              if (el.disabled) continue;
              const style = getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') continue;
              /* `tabindex="0"` ne fait pas une cible tactile : un bloc de code
                 le porte pour être défilable au clavier. Est une cible ce qui
                 est un contrôle par sa balise, ou ce qui s'annonce comme un
                 composant par son rôle. */
              const CONTROLES = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'];
              const ROLES = new Set([
                'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem',
                'menuitemcheckbox', 'menuitemradio', 'switch', 'option',
                'slider', 'spinbutton', 'combobox', 'textbox',
              ]);
              if (!CONTROLES.includes(el.tagName) && !ROLES.has(el.getAttribute('role') ?? '')) continue;
              let r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;

              /* Une case ou un bouton radio fait 18 px et n'a pas à grandir :
                 ce qu'on touche, c'est son étiquette. On mesure donc
                 l'étiquette à sa place, et l'absence d'étiquette est elle-même
                 un défaut que relève check-a11y. */
              if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) {
                const etiquette =
                  el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
                if (!etiquette) continue;
                r = etiquette.getBoundingClientRect();
              }

              /* Un lien dans une phrase a pour cible sa ligne de texte : le
                 grandir casserait l'interligne du paragraphe. La règle ne
                 vise que ce qui se présente comme un objet à toucher. */
              const parent = el.parentElement;
              const dansUnePhrase =
                el.tagName === 'A' &&
                parent &&
                ['P', 'LI', 'DD', 'TD', 'TH', 'SPAN', 'STRONG', 'EM'].includes(parent.tagName) &&
                (parent.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 12;
              if (dansUnePhrase) continue;

              if (r.width < CIBLE - 0.5 || r.height < CIBLE - 0.5) {
                petites.push(
                  `${el.tagName.toLowerCase()}` +
                    `${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}` +
                    ` ${Math.round(r.width)}×${Math.round(r.height)} — « ${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)} »`,
                );
              }
            }
            return [...new Set(petites)];
          })
        : [];

    if (resultat.deborde) {
      echecs++;
      console.error(`  ✗ ${chemin} à ${largeur} px — document large de ${resultat.largeurDocument} px`);
      for (const c of resultat.coupables) console.error(`      ${c}`);
    } else if (cibles.length > 0) {
      echecs++;
      console.error(`  ✗ ${chemin} à ${largeur} px — ${cibles.length} cible(s) tactile(s) sous 44 px`);
      for (const c of cibles.slice(0, 10)) console.error(`      ${c}`);
    } else {
      console.log(`  ok ${chemin} à ${largeur} px`);
    }
    await page.close();
  }
}

await navigateur.close();
serveur.close();

if (echecs) {
  console.error(`\ncheck-overflow : ${echecs} défaut(s) de mise en page\n`);
  process.exit(1);
}
console.log('\ncheck-overflow : aucun débordement, aucune cible tactile trop petite\n');
