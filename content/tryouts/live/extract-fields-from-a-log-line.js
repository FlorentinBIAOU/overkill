/**
 * Essai interactif — découper des lignes de journal en champs.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y vos propres lignes.
 *
 * Le tableau montre les champs lus, ligne par ligne. Ce qui n'a pas pu être
 * découpé n'est pas perdu : il apparaît en bas, avec son numéro de ligne.
 */
import { parseLines } from '../../snippets/extract-fields-from-a-log-line/n0.js';

const T = {
  fr: {
    lu: (n, r) => (r ? `${n} ligne(s) découpée(s), ${r} rejetée(s)` : `${n} ligne(s) découpée(s)`),
    rien: 'Aucune ligne découpée',
    ligne: 'Ligne',
    rejet: (n, t) => `Ligne ${n} rejetée : ${t}`,
  },
  en: {
    lu: (n, r) => (r ? `${n} line(s) parsed, ${r} rejected` : `${n} line(s) parsed`),
    rien: 'No line parsed',
    ligne: 'Line',
    rejet: (n, t) => `Line ${n} rejected: ${t}`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Le motif employé est celui du journal d’accès d’Apache, sauf sur le cas syslog. Rien ne part sur le réseau : le découpage se fait dans votre navigateur.',
    en: 'The pattern used is Apache’s access log one, except on the syslog case. Nothing goes out on the network: the parsing happens in your browser.',
  },

  run(input, lang, cas) {
    const t = T[lang];
    const motif = cas?.motif ?? 'apache-combined';
    const rapport = parseLines(input.split('\n'), motif);
    const champs = rapport.parsed.length > 0
      ? Object.keys(rapport.parsed[0]).filter((k) => k !== 'line')
      : [];
    return {
      rows: {
        columns: [t.ligne, ...champs],
        rows: rapport.parsed.map((p) => [
          String(p.line),
          ...champs.map((c) => ({ v: p[c] ?? '', caught: Boolean(p[c]) })),
        ]),
      },
      verdict: {
        label: rapport.parsed.length
          ? t.lu(rapport.parsed.length, rapport.rejected.length)
          : t.rien,
        detail: rapport.reason
          ?? rapport.rejected.map((r) => t.rejet(r.line, r.text)).join(' · '),
      },
    };
  },

  cases: [
    {
      label: { fr: 'Trois lignes d’un journal d’accès', en: 'Three lines of an access log' },
      input: '192.168.0.12 - jean [10/Oct/2026:13:55:36 +0200] "GET /factures/42 HTTP/1.1" 200 2326 "https://exemple.fr/" "Mozilla/5.0 (X11; Linux x86_64)"\n'
        + '203.0.113.7 - - [10/Oct/2026:13:55:37 +0200] "POST /connexion HTTP/1.1" 302 - "-" "curl/8.5.0"\n'
        + '2001:db8::1 - marie [10/Oct/2026:13:55:38 +0200] "GET /café HTTP/1.1" 404 512 "-" "Mozilla/5.0"',
    },
    {
      label: { fr: 'Les mêmes, avec une ligne d’un autre format au milieu', en: 'The same, with a line of another format in the middle' },
      input: '192.168.0.12 - jean [10/Oct/2026:13:55:36 +0200] "GET /factures/42 HTTP/1.1" 200 2326 "https://exemple.fr/" "Mozilla/5.0"\n'
        + '<34>Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for jean\n'
        + '203.0.113.7 - - [10/Oct/2026:13:55:37 +0200] "POST /connexion HTTP/1.1" 302 - "-" "curl/8.5.0"',
    },
    {
      label: { fr: 'Une ligne syslog, lue par le motif qui lui convient', en: 'A syslog line, read by the pattern that fits it' },
      input: '<34>Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for jean from 203.0.113.7',
      motif: 'syslog-3164',
    },
    {
      label: { fr: 'La même ligne, avec un motif trop lâche', en: 'The same line, with a pattern that is too loose' },
      input: '<34>Oct 10 13:55:36 serveur1 sshd[1234]: Failed password for jean from 203.0.113.7',
      motif: '<%{INT:priority}>%{DATA:timestamp} %{WORD:host} %{DATA:tag}: %{GREEDY:message}',
      fails: true,
      why: {
        fr: 'La ligne correspond, rien n’est rejeté, et les quatre champs sont faux : l’horodatage vaut « Oct », l’hôte vaut « 10 », et l’étiquette a mangé le reste. Décrire une date par « n’importe quoi » laisse l’expression s’arrêter au premier espace. C’est la façon dont un analyseur de journal se trompe en silence, et le cas juste au-dessus montre ce que donne le même motif quand la date est décrite comme une date.',
        en: 'The line matches, nothing is rejected, and all four fields are wrong: the timestamp is “Oct”, the host is “10”, and the tag has swallowed the rest. Describing a date as “anything” lets the expression stop at the first space. This is how a log parser goes quietly wrong, and the case just above shows what the same pattern gives when the date is described as a date.',
      },
    },
  ],
};
