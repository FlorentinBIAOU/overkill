/**
 * Les données du questionnaire, construites à partir du contenu.
 *
 * Rien n'est codé en dur : les familles, les tâches, les niveaux disponibles,
 * la sortie de données, le déterminisme et la testabilité viennent des fiches.
 * Une fiche nouvelle devient atteignable par le questionnaire sans qu'on
 * touche à l'arbre (décisions de clarté, section 4).
 *
 * Ce que la charge utile contient est ce que le verdict a besoin de savoir, et
 * rien de plus : à deux cents fiches, chaque champ inutile se paye.
 */
import { allFamilies, publishedEntries } from './content';
import type { Locale } from '../i18n';

/**
 * Ce que le navigateur reçoit d'une fiche, et rien de plus.
 *
 * Le titre, le besoin, le coût et la latence ne sont pas là : ils sont déjà
 * dans le HTML, en options de question et en cartes rendues par le site. Les
 * répéter dans la charge utile, c'était payer deux fois les mêmes octets.
 */
export interface GuideEntry {
  id: string;
  family: string;
  verdict: string;
  /** La justification de la fiche, affichée telle quelle dans le verdict. */
  rationale: string;
  rungs: {
    level: string;
    available: true;
    name: string;
    risks: {
      data_egress: 'none' | 'own-infra' | 'third-party';
      deterministic: boolean;
      testability: 'unit' | 'statistical' | 'hard';
    };
  }[];
}

export interface GuideFamily {
  id: string;
}

export async function guideData(lang: Locale): Promise<{
  families: GuideFamily[];
  entries: GuideEntry[];
}> {
  const familles = (await allFamilies()).map((f) => f.data);
  const fiches = (await publishedEntries()).map((e) => e.data);

  return {
    families: familles.map((f: any) => ({ id: f.id })),
    entries: fiches.map((e: any) => ({
      id: e.id,
      family: e.family,
      verdict: e.verdict,
      rationale: e.verdict_rationale[lang],
      rungs: e.rungs
        .filter((r: any) => r.available)
        .map((r: any) => ({
          level: r.level,
          available: true as const,
          name: r.name[lang],
          risks: {
            data_egress: r.risks.data_egress,
            deterministic: r.risks.deterministic,
            testability: r.risks.testability,
          },
        })),
    })),
  };
}
