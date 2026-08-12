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

## Command-line control

The CLI controls a running server through the same validated routes as the webpage. It prints JSON, making it suitable for terminal use, automation, and coding agents. Start the application with `./scripts/run.sh` before using the CLI.

```sh
npm run cli -- help
npm run cli -- state
npm run cli -- day show --date 2026-08-09
npm run cli -- medication add --name "Vitamin D" --dose "1000 IU" --time 09:00
npm run cli -- activity add --text "45 minutes brisk walking"
npm run cli -- activity add --image ./workout-summary.png
npm run cli -- food add --time 12:30 --text "chicken sandwich and coffee"
npm run cli -- food add --time 18:00 --image ./dinner.jpg
```

You can also invoke the executable directly:

```sh
./bin/tnt-tracker.mjs day show
./bin/tnt-tracker.mjs tracker set --burn 2800 --factor 0.9 --position 0.5
```

Set `TNT_TRACKER_URL` when the server is not running at the default `http://localhost:3000`:

```sh
TNT_TRACKER_URL=http://tracker-host:3000 npm run cli -- state
```

Deletion commands accept the entry IDs returned by `state` or `day show`. The CLI exits nonzero and prints a JSON error object when a command fails.

See [`SKILL.md`](SKILL.md) for the agent-facing operating contract.

For a production deployment, use the standard Next.js commands:

```sh
npm run build
npm start
```

## Data

Application records are stored in `data/tracker.json`. This file is excluded from Git so personal profile, food, and activity data are not committed.

Food entries store the selected meal time. Medications are tracked separately by name, dose or notes, and time; medication records are never sent through food analysis.

The official 2024 Adult Compendium MET reference is stored in `data/met-compendium.json`. Its source is the [Compendium of Physical Activities](https://pacompendium.com/adult-compendium/). The checked-in import script documents how the local table was produced.

## Energy calculation

- Estimated RMR uses Mifflin–St Jeor.
- Minimal daily baseline is `RMR × 1.20`, a deliberately conservative stationary-day floor with a small allowance for food thermogenesis and unavoidable non-walking movement. Deliberate walking, chores, commuting, and exercise are excluded and should be logged separately.
- Activities snap to one best-matching Compendium row, then apply one explicit percentage adjustment to its net energy for context not represented by that row, such as a light carried load.
- Net active energy excludes the resting energy for the same period:

```text
(MET - 1) × 3.5 × weight_kg ÷ 200 × duration_minutes
```

- The AI burn endpoint is baseline daily burn plus logged net activity.
- Corrected tracker burn is raw tracker burn multiplied by its correction factor.
- The ruler blends the tracker and AI endpoints.

## AI configuration

OpenRouter requests use `openai/gpt-5.6-sol`. AI prompts and structured responses use kilocalories. TNT terminology is applied only by the interface.

Food and activity images are sent to OpenRouter for analysis but are not stored locally.
