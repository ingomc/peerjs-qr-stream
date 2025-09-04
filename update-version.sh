#!/bin/bash

# 🔄 Auto-Versionierung für PeerJS QR Stream
# Erhöht bei jedem Commit die Patch-Nummer (x.y.z+1)

# Aktuelle Version aus index.html extrahieren
CURRENT_VERSION=$(grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' index.html | head -1 | sed 's/v//')

if [ -z "$CURRENT_VERSION" ]; then
    echo "❌ Keine Version gefunden, setze auf 1.0.0"
    NEW_VERSION="1.0.0"
else
    # Version aufteilen
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
    
    # Patch-Nummer erhöhen
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo "🔄 Version Update: $CURRENT_VERSION → $NEW_VERSION"

# Version in beiden HTML-Dateien aktualisieren
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS Version - verwende Perl für bessere RegEx-Kompatibilität
    perl -i -pe "s/v\d+\.\d+\.\d+/v$NEW_VERSION/g" index.html
    perl -i -pe "s/v\d+\.\d+\.\d+/v$NEW_VERSION/g" streamer.html
else
    # Linux Version
    sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" index.html
    sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" streamer.html
fi

echo "✅ Versionsnummer auf v$NEW_VERSION aktualisiert"
