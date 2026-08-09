# Fuel & Motion

A single-user food and activity tracker built with Next.js. Food and activity descriptions are analyzed through OpenRouter, while the interface displays energy numerically as grams of TNT using the convention `1 kcal = 1 g TNT`.

## Requirements

- Node.js 20 or newer
- npm
- An OpenRouter API key

## Setup

Run:

```sh
./scripts/setup.sh
```

Then open `.env` and set:

```dotenv
OPENROUTER_API_KEY=your_key_here
```

The API key is read only by server-side route handlers. `.env` is excluded from Git.

## Running

Start the development server:

```sh
./scripts/run.sh
```

Then visit [http://localhost:3000](http://localhost:3000).

For a production deployment, use the standard Next.js commands:

```sh
npm run build
npm start
```

## Data

Application records are stored in `data/tracker.json`. This file is excluded from Git so personal profile, food, and activity data are not committed.

The official 2024 Adult Compendium MET reference is stored in `data/met-compendium.json`. Its source is the [Compendium of Physical Activities](https://pacompendium.com/adult-compendium/). The checked-in import script documents how the local table was produced.

## Energy calculation

- Estimated RMR uses Mifflin–St Jeor.
- Baseline daily burn is RMR plus a 10% sedentary and food allowance.
- Activities use an exact MET selected from the local Compendium table.
- Net active energy excludes the resting energy for the same period:

```text
(MET - 1) × 3.5 × weight_kg ÷ 200 × duration_minutes
```

- The AI burn endpoint is baseline daily burn plus logged net activity.
- Corrected tracker burn is raw tracker burn multiplied by its correction factor.
- The ruler blends the tracker and AI endpoints.

## AI configuration

OpenRouter requests use `openai/gpt-5.6-terra`. AI prompts and structured responses use kilocalories. TNT terminology is applied only by the interface.

Food images are sent to OpenRouter for analysis but are not stored locally.
