#!/usr/bin/env bash
set -euo pipefail

# 0) Sync manifest.json with .js files present in test/
TEST_DIR="test"
MANIFEST="$TEST_DIR/manifest.json"

if [ ! -f "$MANIFEST" ]; then
  printf '[]\n' > "$MANIFEST"
fi

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
declare -a MISSING_FILES=()
IFS=$'\n'
for f in $DISCOVERED; do
  if ! printf '%s\n' "$CURRENT" | grep -qx "$f"; then
    MISSING_FILES+=("$f")
  fi
done
unset IFS

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo "⚠️  Les scripts suivants ne sont pas listés dans ${MANIFEST} et vont être ajoutés :"
  for f in "${MISSING_FILES[@]}"; do echo "$f"; done

  if command -v jq >/dev/null 2>&1; then
    # Avec jq: append-only pour préserver l'ordre du manifest
    MISSING_JSON=$(printf '%s\n' "${MISSING_FILES[@]}" | sed '/^$/d' | jq -R . | jq -s .)
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
    for f in "${MISSING_FILES[@]}"; do
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
# Demande le message de commit à l'utilisateur et boucle jusqu'à une saisie non vide
COMMIT_MSG=""
while [ -z "${COMMIT_MSG}" ]; do
  read -rp "✍️  Entrez le message de commit: " COMMIT_MSG
done
git commit -m "$COMMIT_MSG" || echo "ℹ️ Rien à committer"
git push

# 2) Message de rappel
cat <<'MSG'

✅ Code TEST poussé sur GitHub Pages.

👉 Vérifie maintenant sur :
   https://poker-sciences.webflow.io

(CTRL/CMD+Shift+R si cache navigateur)

MSG

# 3) Récapitulatif manifest
echo
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo "🧾 Récapitulatif des fichiers ajoutés à ${MANIFEST} :"
  for f in "${MISSING_FILES[@]}"; do
    echo " - $f"
  done
else
  echo "🧾 Aucun nouveau fichier n'a été ajouté à ${MANIFEST}."
fi

echo
echo "ℹ️ Le manifeste (${MANIFEST}) est utilisé par le script sur Webflow loader.js pour charger tous les scripts."