#!/usr/bin/env bash
# Enveloppe du contrôle orthographique français.
#
# Le contrôle a besoin de spylls et du dictionnaire hunspell français. S'ils
# ne sont pas installés, il le dit et passe, plutôt que de bloquer un dépôt
# fraîchement cloné. La CI, elle, les installe et le contrôle y est bloquant.
set -uo pipefail
cd "$(dirname "$0")/.."

PY=.venv-tools/bin/python
if [ ! -x "$PY" ]; then PY=$(command -v python3 || true); fi

if [ -z "$PY" ] || ! "$PY" -c "import spylls" 2>/dev/null; then
  echo "check-french : ignoré (spylls absent — 'pip install spylls' pour l'activer)"
  exit 0
fi

if [ ! -f /usr/share/hunspell/fr_FR.dic ]; then
  echo "check-french : ignoré (dictionnaire français absent — 'apt install hunspell-fr-classical')"
  exit 0
fi

exec "$PY" scripts/check-french.py "$@"
