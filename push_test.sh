#!/usr/bin/env bash
set -euo pipefail

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