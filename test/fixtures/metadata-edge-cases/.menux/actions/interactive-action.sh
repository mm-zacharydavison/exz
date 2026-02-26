#!/bin/bash
# menux:name Interactive Action
# menux:emoji 🔄
# menux:description An action that needs stdin
# menux:interactive true

read -p "Enter your name: " name
echo "Hello, $name!"
