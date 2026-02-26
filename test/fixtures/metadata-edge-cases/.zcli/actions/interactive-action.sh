#!/bin/bash
# zcli:name Interactive Action
# zcli:emoji 🔄
# zcli:description An action that needs stdin
# zcli:interactive true

read -p "Enter your name: " name
echo "Hello, $name!"
