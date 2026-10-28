# Fuel & Motion

A single-user food tracker built with Next.js. Meals are analyzed through OpenRouter, and you type in the total calories your fitness tracker says you burned each day. The interface displays energy numerically as grams of TNT using the convention `1 kcal = 1 g TNT`.

This is the simplified version. The earlier full version, with profile, weight, blood pressure, medication, activity analysis, burn blending, and insight charts, is kept on the `backup-full-version` branch.

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
npm run cli -- burn set --kcal 2400
npm run cli -- food add --time 12:30 --text "chicken sandwich and coffee"
npm run cli -- food add --time 18:00 --image ./dinner.jpg
```

You can also invoke the executable directly:

```sh
./bin/tnt-tracker.mjs day show
./bin/tnt-tracker.mjs burn set --date 2026-08-09 --kcal 2800
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

Application records are stored in `data/tracker.json`. This file is excluded from Git so personal food data is not committed.

The **Data & backup** card exports every saved record to a versioned JSON file. Import validates that file and, after confirmation, replaces the current dataset. Export the current data first if you may want to undo an import.

Local development stores records in `data/tracker.json`. For Vercel deployments, create a **private Blob store** from the project's Storage tab and redeploy. Vercel supplies `BLOB_READ_WRITE_TOKEN` automatically, and the app then stores all live data in `fuel-and-motion/tracker.json` in that private store. If no Blob store is attached, deployed routes return a configuration error instead of attempting to write to Vercel's read-only filesystem.

Food entries store the selected meal time. Each day also stores one number: the total calories burned, copied from your tracker. "How much you can still eat" is that number minus the food logged for the day.

Records created by the full version (profile, weight, blood pressure, medication, activity, burn-blend settings) are left untouched in storage and in JSON backups; this version just doesn't show them. Days created here store only `foods` and `trackerBurn`.

## AI configuration

OpenRouter requests use `openai/gpt-6.1-sol` with medium reasoning effort. AI prompts and structured responses use kilocalories. TNT terminology is applied only by the interface.

Food analysis returns independent ingredient estimates, including protein, carbohydrates, fat, and sodium for each ingredient. The model does not output meal nutrition totals or total ranges. The app adds the ingredient values without rounding the stored sums and derives salt from sodium; display formatting does not affect saved values.

Food photos, the original analysis response, and follow-up conversations are saved with each food entry in the configured tracker storage and included in JSON backups. Open **Analysis & follow-up** on a meal to review its photos, ask questions, or correct the estimate. A follow-up can include photos, such as what is left on the plate after eating; photos of leftovers count as a correction. The model answers in natural language; corrections update that entry’s nutrition and price fields and refresh daily totals. Questions and hypothetical scenarios leave the estimate unchanged. Older entries can use follow-ups, but their previously discarded photos and original responses cannot be recovered.

Each meal or follow-up upload supports up to 6 JPEG, PNG, WebP, or GIF images, totaling at most 3 MB after browser resizing. Saved food photos, including earlier follow-up photos, are sent to OpenRouter again for later follow-ups.
