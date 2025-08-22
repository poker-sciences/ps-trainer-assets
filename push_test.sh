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
  # Supporte l'ancien format (array) et le nouveau (objet {version, files})
  CURRENT=$(jq -r 'if type=="array" then .[] else (.files // [])[] end' "$MANIFEST" 2>/dev/null || true)
else
  # Sans jq: tente d'extraire la section files si elle existe, sinon extrait toutes les chaînes (ancien format array)
  CURRENT=$(sed -n '/"files"[[:space:]]*:/,/]/p' "$MANIFEST" 2>/dev/null | grep -oE '"[^"]+"' | tr -d '"' | grep -v '^files$' || true)
  if [ -z "$CURRENT" ]; then
    CURRENT=$(grep -oE '"[^"]+"' "$MANIFEST" 2>/dev/null | tr -d '"' || true)
  fi
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

# 1) Demande le message de commit et calcule la version
COMMIT_MSG=""
read -rp "✍️  Entrez le message de commit (optionnel): " COMMIT_MSG
DATE_TAG=$(date +'%Y-%m-%d-%H-%M')
SUFFIX=$(printf '%s' "$COMMIT_MSG" | sed -E 's/[[:space:]]+/-/g; s/^-+//; s/-+$//')
if [ -n "$SUFFIX" ]; then
  VERSION="v-${DATE_TAG}-${SUFFIX}"
else
  VERSION="v-${DATE_TAG}"
fi

# Calcule les fichiers obsolètes (présents dans le manifest mais absents de test/)
declare -a STALE_FILES=()
IFS=$'\n'
for f in $CURRENT; do
  if ! printf '%s\n' "$DISCOVERED" | grep -qx "$f"; then
    STALE_FILES+=("$f")
  fi
done
unset IFS

if [ ${#MISSING_FILES[@]} -gt 0 ] || [ ${#STALE_FILES[@]} -gt 0 ]; then
  if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "⚠️  Les scripts suivants ne sont pas listés dans ${MANIFEST} et vont être ajoutés :"
    for f in "${MISSING_FILES[@]}"; do echo "$f"; done
  fi
  if [ ${#STALE_FILES[@]} -gt 0 ]; then
    echo "⚠️  Les scripts suivants sont listés dans ${MANIFEST} mais n'existent plus dans ${TEST_DIR} et vont être retirés :"
    for f in "${STALE_FILES[@]}"; do echo "$f"; done
  fi

  if command -v jq >/dev/null 2>&1; then
    # Avec jq: filtre les obsolètes, ajoute les manquants, et écrit un objet {version, files}
    MISSING_JSON=$(printf '%s\n' "${MISSING_FILES[@]}" | sed '/^$/d' | jq -R . | jq -s .)
    DISCOVERED_JSON=$(printf '%s\n' "$DISCOVERED" | sed '/^$/d' | jq -R . | jq -s .)
    jq --argjson exist "$DISCOVERED_JSON" --argjson add "$MISSING_JSON" --arg ver "$VERSION" \
      '
      def updated(files; exist; add):
        (files // [] | map(select(. as $e | (exist | index($e))))) as $kept
        | ($kept + add);
      if type=="array" then
        { version: $ver, files: updated(.; $exist; $add) }
      else
        { version: $ver, files: updated(.files; $exist; $add) }
      end
      ' \
      "$MANIFEST" > "$MANIFEST.tmp"
    mv "$MANIFEST.tmp" "$MANIFEST"
  else
    # Fallback sans jq: réécrit le manifeste en OBJET {version, files}
    tmp_out=$(mktemp)
    count=0
    # Écrit l'ouverture de l'objet et la version
    printf '{\n' > "$tmp_out"
    printf '  "version": "%s",\n' "$VERSION" >> "$tmp_out"
    printf '  "files": [\n' >> "$tmp_out"
    # Ajoute les entrées existantes (encore présentes) dans l'ordre
    IFS=$'\n'
    for f in $CURRENT; do
      [ -z "$f" ] && continue
      # Ignore les entrées obsolètes qui ne sont plus dans DISCOVERED
      if ! printf '%s\n' "$DISCOVERED" | grep -qx "$f"; then
        continue
      fi
      count=$((count+1))
      if [ $count -gt 1 ]; then printf ',\n' >> "$tmp_out"; fi
      printf '    "%s"' "$f" >> "$tmp_out"
    done
    # Ajoute les manquants à la fin
    for f in "${MISSING_FILES[@]}"; do
      [ -z "$f" ] && continue
      count=$((count+1))
      if [ $count -gt 1 ]; then printf ',\n' >> "$tmp_out"; fi
      printf '    "%s"' "$f" >> "$tmp_out"
    done
    unset IFS
    # Ferme le tableau et l'objet
    printf '\n  ]\n}\n' >> "$tmp_out"
    mv "$tmp_out" "$MANIFEST"
  fi
  echo "✅ ${MANIFEST} mis à jour."
else
  echo "✅ ${MANIFEST} est déjà à jour."
fi

# 2) Commit & push les changements dans test/
git add -A
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
echo "🧾 Récapitulatif des modifications de ${MANIFEST} :"
if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#STALE_FILES[@]} -eq 0 ]; then
  echo " - Aucun changement"
else
  if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo " - Ajoutés :"
    for f in "${MISSING_FILES[@]}"; do echo "   • $f"; done
  fi
  if [ ${#STALE_FILES[@]} -gt 0 ]; then
    echo " - Retirés :"
    for f in "${STALE_FILES[@]}"; do echo "   • $f"; done
  fi
fi

echo
echo "ℹ️ Le manifeste (${MANIFEST}) est utilisé par le script sur Webflow loader.js pour charger tous les scripts."