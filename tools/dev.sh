#!/bin/bash
# Start the site for work: server + desktop tab + mobile window.
# Usage:  tools/dev.sh            (everything)
#          tools/dev.sh -NoOpen    (server only, no windows)
#          tools/dev.sh -Stop      (stop the server)
#
# The server runs in the background, independent of the terminal and Claude session; log in $TMPDIR/stomatologia-serve.log.
# If a server is already listening on the port, a second one is not started.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8081
NOOPEN=0
STOP=0
while [ $# -gt 0 ]; do
  case "$1" in
    -NoOpen) NOOPEN=1 ;;
    -Stop) STOP=1 ;;
    -Port) PORT="$2"; shift ;;
    *) echo "Unknown parameter: $1" >&2; exit 1 ;;
  esac
  shift
done
URL="http://127.0.0.1:$PORT/"

port_up() { nc -z 127.0.0.1 "$PORT" 2>/dev/null; }

if [ "$STOP" = 1 ]; then
  PIDS=$(lsof -ti tcp:"$PORT" -sTCP:LISTEN)
  if [ -n "$PIDS" ]; then kill $PIDS && echo "Server on port $PORT stopped."; else echo "No server running on port $PORT."; fi
  exit 0
fi

if port_up; then
  echo "Server already running: $URL"
else
  nohup "$ROOT/tools/serve.sh" "$PORT" > "${TMPDIR:-/tmp}/stomatologia-serve.log" 2>&1 &
  for _ in $(seq 40); do port_up && break; sleep 0.25; done
  port_up || { echo "Server did not come up on port $PORT within 10 seconds." >&2; exit 1; }
  echo "Server started: $URL   (stop: tools/dev.sh -Stop)"
fi

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
[ "$CODE" = 200 ] || { echo "Server answered $CODE instead of 200." >&2; exit 1; }

IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -n "$IP" ] && echo "From a phone: http://$IP:$PORT/"

[ "$NOOPEN" = 1 ] && exit 0

open "$URL"

# A dedicated profile is required, otherwise it opens as a tab in the running Chrome and the size and user agent are ignored.
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args \
    --user-data-dir="$HOME/Library/Application Support/stomatologia-mobile-preview" \
    --no-first-run --no-default-browser-check \
    --app="$URL" --window-size=406,900 --window-position=40,40 \
    --user-agent="$UA"
  echo 'Opened: desktop tab + mobile window.'
else
  echo 'Chrome not found — no mobile window. Use DevTools → Cmd+Shift+M.'
fi
