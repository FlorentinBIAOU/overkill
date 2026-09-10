#!/usr/bin/env bash
# Sous-ensemblage des trois familles de polices.
#
# Le CDC fixe un budget total de 90 Ko pour les polices (section 12). Les
# sous-ensembles "latin" livres par Fontsource totalisent environ 108 Ko, ce qui
# depasse le budget. On resserre donc le jeu de glyphes au strict necessaire
# pour un site francais et anglais, et on limite l'axe de graisse de la police
# d'affichage aux deux graisses reellement employees (700 et 800).
#
# Ce script n'est pas execute au build : il est lance a la main quand une police
# change, et son resultat est commite dans src/assets/fonts/.
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv-tools/bin/python
SRC_BRICOLAGE=node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2
SRC_INTER_400=node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2
SRC_INTER_600=node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2
SRC_MONO=node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2
OUT=public/fonts
TMPDIR_FONTS=$(mktemp -d)
trap 'rm -rf "$TMPDIR_FONTS"' EXIT
mkdir -p "$OUT"

# Latin de base, plus les diacritiques du francais, plus la ponctuation
# typographique reellement employee sur le site.
UNICODES='U+0020-007E,U+00A0,U+00A9,U+00AB,U+00BB,U+00C0,U+00C2,U+00C6-00CB,U+00CE,U+00CF,U+00D4,U+00D6,U+00D9,U+00DB,U+00DC,U+00E0,U+00E2,U+00E6-00EB,U+00EE,U+00EF,U+00F4,U+00F6,U+00F9,U+00FB,U+00FC,U+00FF,U+0152,U+0153,U+0178,U+00B0,U+00B7,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2192,U+2212,U+2082'

subset () {
  local src=$1 dst=$2; shift 2
  "$PY" -m fontTools.subset "$src" \
    --unicodes="$UNICODES" \
    --layout-features='kern,liga,calt,tnum' \
    --flavor=woff2 \
    --with-zopfli \
    --no-hinting \
    --desubroutinize \
    --drop-tables+=DSIG \
    --name-IDs='' \
    --output-file="$dst" "$@"
}

# Police d'affichage : axe de graisse reduit a 700-800, les seules graisses
# employees par l'echelle typographique de la section 8.4 du CDC.
# Instanciation de l'axe wght en 700-800 avant sous-ensemblage.
"$PY" -m fontTools.varLib.instancer "$SRC_BRICOLAGE" 'wght=700:800' \
  --output="$TMPDIR_FONTS/bricolage-700-800.ttf" >/dev/null
subset "$TMPDIR_FONTS/bricolage-700-800.ttf" "$OUT/bricolage-grotesque-display.woff2"
subset "$SRC_INTER_400" "$OUT/inter-400.woff2"
subset "$SRC_INTER_600" "$OUT/inter-600.woff2"
subset "$SRC_MONO"      "$OUT/jetbrains-mono-400.woff2"

echo "Polices produites :"
ls -l "$OUT"/*.woff2 | awk '{printf "  %6.1f Ko  %s\n", $5/1024, $9}'
echo "Total : $(du -cb "$OUT"/*.woff2 | tail -1 | awk '{printf "%.1f Ko", $1/1024}')"
