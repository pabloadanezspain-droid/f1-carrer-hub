#!/bin/sh
# Mac launcher: double-click in Finder. Starts a tiny local web server for this folder and opens the Career Hub.
# Your save lives in the browser for http://127.0.0.1:5178 - use Edit Career > Import / Export to move a save made via file://.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then echo "Python 3 was not found. Opening the page directly instead."; open index.html; exit 0; fi
# stop any server left running from an older copy, then serve THIS folder
lsof -ti :5178 2>/dev/null | xargs kill 2>/dev/null
sleep 0.5
(python3 -m http.server 5178 --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 1
# ?v= makes the browser load the newest index.html instead of a cached copy
open "http://127.0.0.1:5178/index.html?v=$(date +%s)"
