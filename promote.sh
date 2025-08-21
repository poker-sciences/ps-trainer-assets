#!/usr/bin/env bash
set -euo pipefail

# 1) Sauvegarde de test/
backup="test_backup_$(date +%F_%H%M%S)"
cp -a test "$backup"
echo "🗂  Backup créé: $backup"

# 2) Promotion: test → prod (copie exacte)
rsync -av --delete test/ prod/

# 3) Commit & push
git add -A
git commit -m "promote: test → prod ($(date +%F_%H%M))" || echo "ℹ️ Rien à committer"
git push

# 4) Rappel fort: incrémente la VERSION dans le loader Webflow
cat <<'MSG'

🔔 IMPORTANT — Pense à incrémenter la VERSION dans le loader Webflow !
    var VERSION = 'vX';  // passe à vX+1 pour forcer le refresh navigateur

👉 Où : Webflow > Navbar Ranges > Code TrainerApp > loader_code.js

MSG

echo "✅ Promotion terminée."