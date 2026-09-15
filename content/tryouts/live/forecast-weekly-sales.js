/**
 * Essai interactif — prévoir les ventes de la semaine prochaine.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * La saisie est l'historique, une valeur par semaine, la plus ancienne
 * d'abord : c'est ce que l'extrait ajuste, et c'est la seule façon de montrer
 * qu'un même code prévoit juste sur un historique et faux sur un autre. Les
 * séries des cas sont des pains vendus, semaine par semaine, dans une
 * boulangerie de quartier.
 */
import { fit, forecast } from '../../snippets/forecast-weekly-sales/n1.js';

// Quatre semaines devant, quatre semaines derrière : de quoi lire la suite que
// le modèle propose sans noyer le tableau.
const HORIZON = 4;

const T = {
  fr: {
    colonnes: ['Semaine', 'Ventes observées', 'Ventes prévues'],
    passe: ['il y a quatre semaines', 'il y a trois semaines', 'il y a deux semaines', 'la semaine dernière'],
    futur: ['la semaine prochaine', 'dans deux semaines', 'dans trois semaines', 'dans quatre semaines'],
    note: (semaines, croissance) => `${semaines} semaines d’historique ajustées. Croissance lue dans la série : ${croissance > 0 ? '+' : ''}${croissance} pain${Math.abs(croissance) > 1 ? 's' : ''} par an.`,
    refus: 'Refusé : historique trop court',
    illisible: 'Aucun nombre à lire dans cette saisie.',
  },
  en: {
    colonnes: ['Week', 'Sales recorded', 'Sales forecast'],
    passe: ['four weeks ago', 'three weeks ago', 'two weeks ago', 'last week'],
    futur: ['next week', 'in two weeks', 'in three weeks', 'in four weeks'],
    note: (semaines, croissance) => `${semaines} weeks of history fitted. Growth read out of the series: ${croissance > 0 ? '+' : ''}${croissance} loa${Math.abs(croissance) > 1 ? 'ves' : 'f'} a year.`,
    refus: 'Refused: history too short',
    illisible: 'No number to read in this input.',
  },
};

/** L'historique tel qu'on le tape : des nombres séparés par ce qu'on veut. */
function historique(saisie) {
  return (saisie.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
}

export default {
  level: 'N1',

  note: {
    fr: 'Le coefficient de croissance est le nombre à lire avant la prévision : un modèle qui a trouvé une tendance que personne dans la maison ne reconnaît est un modèle dont il faut se méfier.',
    en: 'The growth coefficient is the number to read before the forecast: a model that has found a trend nobody in the business recognises is a model to distrust.',
  },

  run(saisie, lang) {
    const t = T[lang];
    const semaines = historique(saisie);
    if (semaines.length === 0) return { error: t.illisible };

    let modele;
    try {
      modele = fit(semaines);
    } catch (erreur) {
      /* L'extrait refuse un historique plus court qu'un cycle complet. Le
         message affiché est le sien. */
      return { verdict: { label: t.refus, detail: erreur.message } };
    }

    const prevues = forecast(modele, HORIZON);
    const observees = semaines.slice(-HORIZON);
    return {
      rows: {
        columns: t.colonnes,
        rows: [
          ...observees.map((valeur, i) => [
            t.passe[t.passe.length - observees.length + i],
            String(Math.round(valeur)),
            '',
          ]),
          ...prevues.map((valeur, i) => [
            t.futur[i],
            '',
            { v: String(Math.round(valeur)), caught: true },
          ]),
        ],
      },
      note: t.note(semaines.length, Math.round(modele.coefficients[1])),
    };
  },

  /* Les historiques restent des chaînes simples : une suite de ventes
     hebdomadaires ne se traduit pas. */
  cases: [
    {
      label: { fr: 'Deux ans dans une boulangerie qui monte', en: 'Two years in a bakery on the way up' },
      input: '860 898 892 893 929 941 918 922 950 942 918 934 957 940 929 959 975 956 961 995 996 974 986 1008 986 958 968 965 921 893 896 872 821 805 808 777 741 750 762 740 737 775 796 792 821 877 898 906 955 1006 1014 1027 1076 1104 1094 1106 1142 1143 1122 1137 1160 1142 1126 1150 1163 1141 1141 1173 1178 1159 1175 1206 1197 1180 1202 1215 1186 1169 1183 1169 1123 1107 1109 1073 1026 1020 1017 977 950 966 967 942 950 989 998 996 1036 1086 1098 1115 1171 1212 1215 1239',
    },
    {
      label: { fr: 'Deux ans sans tendance, mais avec des saisons', en: 'Two years with no trend, but with seasons' },
      input: '1000 1034 1024 1021 1053 1061 1034 1034 1058 1046 1018 1030 1049 1028 1013 1039 1051 1028 1029 1059 1056 1030 1038 1056 1030 998 1004 997 949 917 916 888 833 813 812 777 737 742 750 724 717 751 768 760 785 837 854 858 903 950 954 963 1008 1032 1018 1026 1058 1055 1030 1041 1060 1038 1018 1038 1047 1021 1017 1045 1046 1023 1035 1062 1049 1028 1046 1055 1022 1001 1011 993 943 923 921 881 830 820 813 769 738 750 747 718 722 757 762 756 792 838 846 859 911 948 947 967',
    },
    {
      label: { fr: 'Cinq semaines d’historique', en: 'Five weeks of history' },
      input: '1180 1145 1205 1240 1198',
    },
    {
      label: { fr: 'Un concurrent a ouvert il y a vingt semaines', en: 'A competitor opened twenty weeks ago' },
      input: '860 898 892 893 929 941 918 922 950 942 918 934 957 940 929 959 975 956 961 995 996 974 986 1008 986 958 968 965 921 893 896 872 821 805 808 777 741 750 762 740 737 775 796 792 821 877 898 906 955 1006 1014 1027 1076 1104 1094 1106 1142 1143 1122 1137 1160 1142 1126 1150 1163 1141 1141 1173 1178 1159 1175 1206 1197 1180 1202 1215 1186 1169 1183 1169 1123 1107 1109 1073 718 714 712 684 665 676 677 659 665 692 699 697 725 760 769 781 820 848 851 867',
      fails: true,
      why: {
        fr: 'La boulangerie vend moins de neuf cents pains par semaine depuis l’ouverture d’un concurrent, il y a vingt semaines, et la prévision en annonce plus de mille : un niveau qu’elle n’a plus atteint depuis. Les moindres carrés pèsent une semaine d’il y a deux ans exactement comme la semaine dernière, donc l’ajustement coupe la poire en deux entre l’ancien monde et le nouveau — et lit encore une croissance de plus de quatre-vingts pains par an sur un commerce qui a perdu trente pour cent de ses ventes. Rien n’est faux dans le modèle ; c’est l’hypothèse qu’une seule droite décrit tout l’historique qui l’est.',
        en: 'The bakery has been selling under nine hundred loaves a week since a competitor opened twenty weeks ago, and the forecast announces more than a thousand: a level it has not reached since. Least squares weighs a week from two years ago exactly as much as last week, so the fit splits the difference between the old world and the new one — and still reads a growth of more than eighty loaves a year on a shop that has lost thirty per cent of its sales. Nothing in the model is wrong; the assumption that one straight line describes the whole history is.',
      },
    },
  ],
};
