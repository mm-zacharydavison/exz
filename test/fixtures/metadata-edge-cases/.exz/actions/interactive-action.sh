#!/bin/bash
# exz:name Interactive Action
# exz:emoji 🔄
# exz:description An action that needs stdin
# exz:interactive true

read -p "Enter your name: " name
echo "Hello, $name!"
