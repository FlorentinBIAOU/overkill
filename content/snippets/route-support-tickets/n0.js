/**
 * Route a support ticket with keyword rules: ordered, with a default team.
 *
 * Rung N0. Deterministic, no dependency, and every decision can be explained
 * to the person who asks why their ticket landed where it did.
 *
 * Two things turn a keyword list into a rule a support desk can actually run.
 *
 * First, an explicit priority. Tickets mention several subjects, so two teams
 * matching the same ticket is the normal case, not the exception. The order of
 * RULES answers it once and in writing, rather than leaving it to whichever
 * branch happens to run first.
 *
 * Second, a default team. Every ticket must land somewhere; a ticket that
 * matches nothing has to go to a queue a human watches, not to the floor.
 */

// The queue that gets everything the rules cannot place. Naming it here, next
// to the rules, is what stops a ticket from silently going nowhere.
export const DEFAULT_TEAM = 'general';

/**
 * Business knowledge, kept next to the code that applies it.
 *
 * The order is the priority, and it is a business decision, not a detail of
 * implementation: a billing problem has a legal clock on it, an outage blocks
 * the customer's work, a parcel is the one that can wait a day. Whoever
 * disagrees can reorder this list and nothing else.
 */
export const RULES = [
  ['billing', ['facture', 'remboursement', 'prélèvement', 'iban', 'devis', 'paiement']],
  ['technical', ['bug', 'erreur', 'panne', 'connexion', 'mot de passe', 'identifiant']],
  ['shipping', ['livraison', 'colis', 'transporteur', 'expédition', 'suivi', 'retard']],
];

/** Lowercase and drop accents, so « Prélèvement » matches « prelevement ». */
function fold(text) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

// A word boundary on the left only. « facture » then also matches « factures »
// and « facturation », which is what French tickets are full of; the price is
// that it would match a longer word starting the same way.
const COMPILED = RULES.map(([team, words]) => [
  team,
  words.map((word) => [word, new RegExp(`\\b${fold(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)]),
]);

/**
 * Every team the ticket triggers, with the words that triggered it.
 *
 * The routing decision needs only the first team, but the reviewer of a
 * misrouted ticket needs this: it shows what the rules saw, and what they had
 * to drop.
 */
export function matches(ticket) {
  const folded = fold(ticket);
  const found = {};
  for (const [team, patterns] of COMPILED) {
    const hits = patterns.filter(([, pattern]) => pattern.test(folded)).map(([word]) => word);
    if (hits.length) found[team] = hits;
  }
  return found;
}

/** The team that gets the ticket. Always one, and always a real queue. */
export function route(ticket, defaultTeam = DEFAULT_TEAM) {
  const found = matches(ticket);
  for (const [team] of RULES) {
    if (team in found) return team;
  }
  return defaultTeam;
}
