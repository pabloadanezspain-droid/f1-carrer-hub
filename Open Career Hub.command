#!/bin/sh
# Mac launcher: double-click in Finder. Starts a tiny local web server for this folder and opens the Career Hub.
# Your save lives in the browser for http://127.0.0.1:5178 - use Edit Career > Import / Export to move a save made via file://.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then echo "Python 3 was not found. Opening the page directly instead."; open index.html; exit 0; fi
lsof -i :5178 >/dev/null 2>&1 || (python3 -m http.server 5178 --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 1
open http://127.0.0.1:5178/
