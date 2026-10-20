#!/bin/bash
# Local static server for previewing the site.
# Usage:  tools/serve.sh [port]        (Ctrl+C to stop)
# Listens on the whole network, so a phone on the same Wi-Fi can open it too.
cd "$(dirname "$0")/.." || exit 1
PORT="${1:-8081}"

ipconfig getifaddr en0 2>/dev/null | sed "s|.*|On the network: http://&:$PORT/|"
exec python3 - "$PORT" <<'PY'
import sys, http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.woff2': 'font/woff2', '.webp': 'image/webp',
                      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                      '.css': 'text/css; charset=utf-8'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

port = int(sys.argv[1])
print(f'Server: http://127.0.0.1:{port}/   Ctrl+C to stop', flush=True)
http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
PY
