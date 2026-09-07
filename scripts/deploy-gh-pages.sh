#!/usr/bin/env bash
set -euo pipefail
# Redeploy Famlist (checking-lists) to GitHub Pages
# Requires: gh auth login (or GITHUB_TOKEN)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
bun install
EXPO_BASE_URL=/checking-lists bunx expo export --platform web
cp dist/index.html dist/404.html
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -a dist/. "$TMP/"
cd "$TMP"
git init
git checkout -b gh-pages
git add -A
git -c user.email="dongpf@hotmail.com" -c user.name="pengfei-bot" commit -m "Deploy Expo web static site"
git remote add origin https://github.com/pengfei-bot/checking-lists.git
git push -f origin gh-pages
echo "Deployed: https://pengfei-bot.github.io/checking-lists/"
