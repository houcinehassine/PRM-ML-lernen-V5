#!/bin/bash
# ============================================================
#  PRM – Lokaler Webserver (Mac)
#  Doppelklick auf diese Datei startet den Server
#  und öffnet den Browser automatisch.
# ============================================================

# Ins Projektverzeichnis wechseln (dort wo diese Datei liegt)
cd "$(dirname "$0")"

PORT=4200

# Prüfen ob Port schon belegt
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Port $PORT ist schon belegt – öffne Browser direkt..."
  open "http://localhost:$PORT/index.html"
  exit 0
fi

echo "========================================"
echo "  PRM Webserver läuft auf Port $PORT"
echo "  http://localhost:$PORT"
echo "  Fenster schließen = Server stoppen"
echo "========================================"

# Browser nach kurzer Pause öffnen
(sleep 1 && open "http://localhost:$PORT/index.html") &

# Python-Server starten
python3 -m http.server $PORT
