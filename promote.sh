#!/usr/bin/env bash
set -euo pipefail

# --- paramètres ---
BACKUP_DIR="backups_prod"

# --- vérifs rapides ---
[[ -d test && -d prod ]] || { echo "❌ Lance ce script à la racine du repo (dossiers test/ et prod/ requis)."; exit 1; }

# --- 1) sauvegarde de PROD avant écrasement ---
mkdir -p "$BACKUP_DIR"
ts="$(date +%F_%H%M%S)"
backup_path="$BACKUP_DIR/prod_backup_${ts}"
cp -a prod "$backup_path"
echo "🗂  Backup PROD -> $backup_path"

# --- 2) promotion : TEST -> PROD (copie exacte du contenu) ---
rsync -av --delete test/ prod/
echo "⬆️  Promotion : test → prod"

# --- 3) versionnage du manifeste PROD ---
COMMIT_MSG=""
read -rp "✍️  Entrez le message de commit (optionnel): " COMMIT_MSG
DATE_TAG=$(date +'%Y-%m-%d-%H-%M')
# Remplace les tirets du message par des espaces
SUFFIX=$(printf '%s' "$COMMIT_MSG" | sed -E 's/-+/ /g; s/^ +//; s/ +$//')
if [ -n "$SUFFIX" ]; then
  VERSION="v-${DATE_TAG}-${SUFFIX}"
else
  VERSION="v-${DATE_TAG}"
fi

PROD_MANIFEST="prod/manifest.json"
if command -v jq >/dev/null 2>&1; then
  jq --arg ver "$VERSION" '
    if type=="array" then
      { version: $ver, files: . }
    else
      { version: $ver, files: (.files // []) }
    end
  ' "$PROD_MANIFEST" > "$PROD_MANIFEST.tmp"
  mv "$PROD_MANIFEST.tmp" "$PROD_MANIFEST"
else
  CURRENT_FILES=$(sed -n '/"files"[[:space:]]*:/,/]/p' "$PROD_MANIFEST" 2>/dev/null | grep -oE '"[^\"]+"' | tr -d '"' | grep -v '^files$' || true)
  if [ -z "$CURRENT_FILES" ]; then
    CURRENT_FILES=$(grep -oE '"[^\"]+"' "$PROD_MANIFEST" 2>/dev/null | tr -d '"' || true)
  fi
  tmp_out=$(mktemp)
  count=0
  printf '{\n' > "$tmp_out"
  printf '  "version": "%s",\n' "$VERSION" >> "$tmp_out"
  printf '  "files": [\n' >> "$tmp_out"
  IFS=$'\n'
  for f in $CURRENT_FILES; do
    [ -z "$f" ] && continue
    count=$((count+1))
    if [ $count -gt 1 ]; then printf ',\n' >> "$tmp_out"; fi
    printf '    "%s"' "$f" >> "$tmp_out"
  done
  unset IFS
  printf '\n  ]\n}\n' >> "$tmp_out"
  mv "$tmp_out" "$PROD_MANIFEST"
fi

# --- 4) commit & push ---
git add -A
git commit -m "$COMMIT_MSG" || echo "ℹ️ Rien à committer"
git push

# --- 5) rappel version du loader ---
cat <<'MSG'

🔔 IMPORTANT — Pense à incrémenter la VERSION dans le loader Webflow :
    var VERSION = 'vX';  // passe à vX+1 pour forcer le refresh navigateur chez les utilisateurs

👉 Où : Webflow > Navbar Ranges > Code TrainerApp > loader_code.js

MSG

echo "✅ Promotion terminée."