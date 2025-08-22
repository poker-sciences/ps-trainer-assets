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

# --- 3) commit & push ---
git add -A
COMMIT_MSG=""
read -rp "✍️  Entrez le message de commit (optionnel): " COMMIT_MSG
git commit -m "$COMMIT_MSG" || echo "ℹ️ Rien à committer"
git push

# --- 4) rappel version du loader ---
cat <<'MSG'

🔔 IMPORTANT — Pense à incrémenter la VERSION dans le loader Webflow :
    var VERSION = 'vX';  // passe à vX+1 pour forcer le refresh navigateur chez les utilisateurs

👉 Où : Webflow > Navbar Ranges > Code TrainerApp > loader_code.js

MSG

echo "✅ Promotion terminée."