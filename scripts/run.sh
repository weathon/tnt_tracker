#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Run ./scripts/setup.sh first."
  exit 1
fi

if ! grep -q '^OPENROUTER_API_KEY=..' .env; then
  echo "Set OPENROUTER_API_KEY in .env before starting the app."
  exit 1
fi

exec npm run dev
