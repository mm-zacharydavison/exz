#!/bin/bash
# menux:name Publish
# menux:emoji 📦
# menux:description Publish menux to npm using pubz
# menux:confirm true
# menux:interactive true

set -euo pipefail

echo "Building menux..."
bun run build

echo ""
echo "Publishing with pubz..."
bunx pubz "$@"
