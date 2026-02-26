#!/bin/bash
# kadai:name Environment Variables
# kadai:emoji 📋
# kadai:description Print kadai-injected environment variables

echo "=== Kadai Environment ==="
echo ""
env | grep -i kadai || echo "(no kadai env vars set)"
echo ""
echo "=== Working Directory ==="
pwd
