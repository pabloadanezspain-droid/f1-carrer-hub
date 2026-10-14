#!/bin/sh
# Usage: tools/shoot.sh <name> <hash-route> <width> <height>
# Full-height capture of the local preview (python -m http.server 5178) with headless Chrome.
# Widths below ~500px are clamped by headless Chrome: for phone widths it renders mframe.html (375px iframe) and crops.
OUT="$(cd "$(dirname "$0")/.." && pwd)/reference/build-shots"
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
FILE="$(cygpath -w "$OUT")\\$1.png"
if [ "$3" -lt 500 ]; then URL="http://127.0.0.1:5178/mframe.html?h=$4$2"; W=500; else URL="http://127.0.0.1:5178/$2"; W=$3; fi
"$CH" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$TEMP/f1ch-shot-$$" \
  --window-size="$W,$4" --virtual-time-budget=6000 --screenshot="$FILE" "$URL" >/dev/null 2>&1
if [ "$3" -lt 500 ]; then python -c "from PIL import Image;import sys;p=sys.argv[1];im=Image.open(p);im.crop((0,0,$3,im.height)).save(p)" "$FILE"; fi
echo "$FILE"
