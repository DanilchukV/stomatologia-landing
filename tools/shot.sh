#!/bin/bash
# Screenshots and measurements without opening windows.
# Examples:
#   tools/shot.sh                                   # 1440 and 390, top of the page
#   tools/shot.sh -Target "#services" -Width 1440,1024,390
#   tools/shot.sh -Target ".hero h1" -Width 1440 -Scale 3 -Height 200
#   tools/shot.sh -Target "#services" -Js "ov('#services .card')" -NoShot
#   tools/shot.sh -Target "#form" -Do "document.querySelector('#form button[type=submit]').click()"
#   tools/shot.sh -NoShot -Wait 2500 -Js "..."      # -Wait: ms after -Do before measuring (default 400)
#
# tools/shot.html is the harness; helpers ov(sel) and box(sel); -Do runs before scrolling and the shot.
# Shots: $TMPDIR/stomatologia-shots/shot-<width>.png. Starts the server if it isn't running.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIDTH="1440,390"; HEIGHT=900; TARGET=""; JS=""; DO=""; WAIT=""; SCALE=1; OFFSET=100; NOSHOT=0
OUT="${TMPDIR:-/tmp/}stomatologia-shots"; PORT=8081
while [ $# -gt 0 ]; do
  case "$1" in
    -Width) WIDTH="$2"; shift ;;
    -Height) HEIGHT="$2"; shift ;;
    -Target) TARGET="$2"; shift ;;
    -Js) JS="$2"; shift ;;
    -Do) DO="$2"; shift ;;
    -Wait) WAIT="$2"; shift ;;
    -Scale) SCALE="$2"; shift ;;
    -Offset) OFFSET="$2"; shift ;;
    -NoShot) NOSHOT=1 ;;
    -Out) OUT="$2"; shift ;;
    -Port) PORT="$2"; shift ;;
    *) echo "Unknown parameter: $1" >&2; exit 1 ;;
  esac
  shift
done

nc -z 127.0.0.1 "$PORT" 2>/dev/null || "$ROOT/tools/dev.sh" -Port "$PORT" -NoOpen > /dev/null || exit 1

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo 'Chrome not found.' >&2; exit 1; }

mkdir -p "$OUT"
# A fresh profile per run: two parallel sessions sharing a profile interfere (empty result).
PROFILE="$(mktemp -d "${TMPDIR:-/tmp/}stomatologia-shot-profile-XXXX")"
trap 'rm -rf "$PROFILE"' EXIT

urlenc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }

# On macOS headless Chrome writes its output but never exits — wait for the done marker and kill it.
browser() {
  local done_marker="$1" done_file="$2"; shift 2
  : > "$OUT/chrome-err.txt"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$PROFILE" --virtual-time-budget=10000 "$@" > "${STDOUT:-/dev/null}" 2>> "$OUT/chrome-err.txt" &
  local pid=$!
  for _ in $(seq 120); do
    grep -q "$done_marker" "$done_file" 2>/dev/null && break
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}

for W in $(echo "$WIDTH" | tr ',' ' '); do
  QS="w=$W&h=$HEIGHT&off=$OFFSET"
  [ -n "$DO" ] && QS="$QS&do=$(urlenc "$DO")"
  [ -n "$WAIT" ] && QS="$QS&wait=$WAIT"
  [ -n "$TARGET" ] && QS="$QS&t=$(urlenc "$TARGET")"
  BASE="http://127.0.0.1:$PORT/tools/shot.html?$QS"
  NAME="shot-$W"
  WIN="--window-size=$W,$HEIGHT"

  if [ "$NOSHOT" = 0 ]; then
    PNG="$OUT/$NAME.png"
    rm -f "$PNG"
    browser "bytes written to file" "$OUT/chrome-err.txt" "$WIN" --force-device-scale-factor="$SCALE" --screenshot="$PNG" "$BASE"
    if [ -f "$PNG" ]; then echo "shot $W: $PNG"; else echo "shot $W: FAILED"; fi
  fi

  if [ -n "$JS" ] || [ "$NOSHOT" = 1 ]; then
    DOM="$OUT/$NAME.dom.txt"
    JSQ=""; [ -n "$JS" ] && JSQ="&js=$(urlenc "$JS")"
    STDOUT="$DOM" browser "</html>" "$DOM" "$WIN" --dump-dom "$BASE$JSQ"
    RES=$(python3 -c '
import re,sys,html
m=re.search(r"<pre id=\"RES\">([\s\S]*?)</pre>",open(sys.argv[1],encoding="utf-8").read())
print(html.unescape(m.group(1)) if m else "no result")' "$DOM")
    echo "js $W: $RES"
  fi
done
