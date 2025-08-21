#!/usr/bin/env bash
set -euo pipefail

# 0) Sync manifest.json with .js files present in test/
TEST_DIR="test"
MANIFEST="$TEST_DIR/manifest.json"

echo "🔎 Vérification des scripts manquants dans ${MANIFEST}…"

# Liste des fichiers .js présents dans test/ (sans manifest.json)
DISCOVERED=$( (cd "$TEST_DIR" && ls -1 *.js 2>/dev/null || true) | sed '/^manifest\.json$/d' || true )

# Liste actuelle du manifest (format: lignes sans guillemets)
if command -v jq >/dev/null 2>&1; then
  CURRENT=$(jq -r '.[]' "$MANIFEST" 2>/dev/null || true)
else
  CURRENT=$(grep -oE '"[^"]+"' "$MANIFEST" 2>/dev/null | tr -d '"' || true)
fi

# Calcule les fichiers manquants (présents dans test/ mais absents du manifest)
MISSING=""
IFS=$'\n'
for f in $DISCOVERED; do
  if ! printf '%s\n' "$CURRENT" | grep -qx "$f"; then
    MISSING+="$f\n"
  fi
done
unset IFS

if [ -n "${MISSING:-}" ]; then
  echo "⚠️  Les scripts suivants ne sont pas listés dans ${MANIFEST} et vont être ajoutés :"
  printf '%s' "$MISSING"

  if command -v jq >/dev/null 2>&1; then
    # Avec jq: append-only pour préserver l'ordre du manifest
    MISSING_JSON=$(printf '%s\n' "$MISSING" | sed '/^$/d' | jq -R . | jq -s .)
    jq --argjson add "$MISSING_JSON" '. + $add' "$MANIFEST" > "$MANIFEST.tmp"
    mv "$MANIFEST.tmp" "$MANIFEST"
  else
    # Fallback sans jq: réécrit le manifest en conservant l'ordre existant puis en ajoutant les manquants
    tmp_out=$(mktemp)
    count=0
    # Écrit l'ouverture
    printf '[\n' > "$tmp_out"
    # Ajoute les entrées existantes dans l'ordre
    IFS=$'\n'
    for f in $CURRENT; do
      [ -z "$f" ] && continue
      count=$((count+1))
      if [ $count -gt 1 ]; then printf ',\n' >> "$tmp_out"; fi
      printf '  "%s"' "$f" >> "$tmp_out"
    done
    # Ajoute les manquants à la fin
    for f in $MISSING; do
      [ -z "$f" ] && continue
      count=$((count+1))
      if [ $count -gt 1 ]; then printf ',\n' >> "$tmp_out"; fi
      printf '  "%s"' "$f" >> "$tmp_out"
    done
    unset IFS
    # Ferme le tableau
    printf '\n]\n' >> "$tmp_out"
    mv "$tmp_out" "$MANIFEST"
  fi
  echo "✅ ${MANIFEST} mis à jour."
else
  echo "✅ ${MANIFEST} est déjà à jour."
fi

# 1) Commit & push les changements dans test/
git add -A
git commit -m "push(test): update test ($(date +%F_%H%M))" || echo "ℹ️ Rien à committer"
git push

# 2) Message de rappel
cat <<'MSG'

✅ Code TEST poussé sur GitHub Pages.

👉 Vérifie maintenant sur :
   https://poker-sciences.webflow.io

(CTRL/CMD+Shift+R si cache navigateur)

MSG