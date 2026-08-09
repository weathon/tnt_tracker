#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required."
  exit 1
fi

npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Add your OPENROUTER_API_KEY before running the app."
else
  echo ".env already exists and was left unchanged."
fi

echo "Setup complete. Run ./scripts/run.sh to start the app."
