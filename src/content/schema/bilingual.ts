import { z } from 'zod';

/**
 * Champ bilingue. Les deux langues sont obligatoires et non vides.
 * CDC 5.2 : « tous les champs bilingues ont leurs deux langues renseignées ».
 * CDC 9.3 : « une fiche dont une langue est incomplète ne se publie pas ».
 */
export const bilingual = (what = 'ce champ') =>
  z.object({
    fr: z.string().trim().min(1, `${what} : la version française est vide`),
    en: z.string().trim().min(1, `${what} : la version anglaise est vide`),
  });

/** Liste bilingue, employée pour le périmètre réglementaire. */
export const bilingualList = (what = 'ce champ') =>
  z.object({
    fr: z.array(z.string().trim().min(1)).min(1, `${what} : la liste française est vide`),
    en: z.array(z.string().trim().min(1)).min(1, `${what} : la liste anglaise est vide`),
  });
