#!/usr/bin/env bash
set -euo pipefail
# Redeploy Famlist (checking-lists) to GitHub Pages
# Requires: gh auth login (or GITHUB_TOKEN)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
bun install
EXPO_BASE_URL=/checking-lists bunx expo export --platform web

# Cache-bust index.html entry script (?v=) + no-store headers meta
STAMP=$(git rev-parse --short HEAD)
python3 - <<PY2
from pathlib import Path
import re, time
stamp = "${STAMP}"
html = Path("dist/index.html")
text = html.read_text()
# ensure cache meta
if "Cache-Control" not in text:
    text = text.replace("<head>", '<head><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/><meta http-equiv="Pragma" content="no-cache"/><meta name="famlist-build" content="'+stamp+'"/>', 1)
else:
    text = re.sub(r'content="[^"]*"(\s*/?>)', lambda m: m.group(0), text, count=0)
    text = re.sub(r'name="famlist-build" content="[^"]*"', f'name="famlist-build" content="{stamp}"', text)
# bust script src
text = re.sub(r'(src="[^"]+\.js)(?:\?v=[^"]*)?(")', rf'\1?v={stamp}\2', text)
html.write_text(text)
print("cache-bust", stamp)
PY2
cp dist/index.html dist/404.html

cp privacy.html dist/privacy.html
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
