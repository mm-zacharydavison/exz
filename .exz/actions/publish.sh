#!/bin/bash
# exz:name Publish
# exz:emoji 📦
# exz:description Publish exz to npm using pubz
# exz:confirm true
# exz:interactive true

set -euo pipefail

echo "Building exz..."
bun run build

echo ""
echo "Publishing with pubz..."
bunx pubz "$@"
