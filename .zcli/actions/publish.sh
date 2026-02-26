#!/bin/bash
# zcli:name Publish
# zcli:emoji 📦
# zcli:description Publish zcli to npm using pubz
# zcli:confirm true
# zcli:interactive true

set -euo pipefail

echo "Building zcli..."
bun run build

echo ""
echo "Publishing with pubz..."
bunx pubz "$@"
