---
name: control-tnt-tracker
description: Control the Fuel & Motion food, activity, medication, profile, tracker-burn, and daily energy records through its JSON CLI. Use when an agent needs to inspect tracker state, analyze and record food or activity, log medication, update profile or burn-blend inputs, or delete a dated entry in this repository's running application.
---

# Control Fuel & Motion

Use `npm run cli -- <command>` from the repository root. The application server must be running. Use `TNT_TRACKER_URL` if it is not available at `http://localhost:3000`.

## Operating rules

- Use the CLI instead of editing `data/tracker.json` directly.
- Never read, print, or modify `.env` or expose `OPENROUTER_API_KEY`.
- Treat all output as JSON. Check the exit code; failures print `{ "error": "..." }` to stderr and exit nonzero.
- Pass `--date YYYY-MM-DD` for historical records. Without it, the CLI uses the machine's local date.
- Pass `--time HH:MM` when the user supplies a time. Without it, food and medication commands use local current time.
- Read `day show` before deleting an entry. Delete only the exact returned ID requested by the user.
- Expect food and activity additions to call the configured AI service. Do not retry automatically after an error.
- Keep medication separate from food. Medication commands never call food analysis.
- Interpret stored energy numbers as kilocalories internally; the interface displays them 1:1 as `g TNT`.

## Inspect records

```sh
npm run cli -- state
npm run cli -- day show
npm run cli -- day show --date 2026-08-09
```

Prefer `day show` when only one date is relevant. It returns the global profile and the selected day's record.

## Update profile and burn blend

```sh
npm run cli -- profile set --sex male --age 22 --height 173 --weight 80
npm run cli -- tracker set --date 2026-08-09 --burn 2800 --factor 0.9 --position 0.5
npm run cli -- tracker set --date 2026-08-09 --burn none --factor 1 --position 0.5
```

Use ruler position `0` for the corrected tracker endpoint, `1` for the AI endpoint, or a decimal between them.

## Record food

Use text, one or more images, or both. Repeat `--image` for multiple files.

```sh
npm run cli -- food add --date 2026-08-09 --time 12:30 --text "Chicken sandwich and coffee"
npm run cli -- food add --time 18:00 --image ./dinner.jpg
npm run cli -- food add --time 18:00 --text "Only ate half" --image ./plate.jpg --image ./label.png
```

Supported image extensions are `.jpg`, `.jpeg`, `.png`, `.webp`, and `.gif`.

## Record activity

Include duration, distance, steps, pace, carried load, resistance, and heart rate when known. Activity analysis selects one best Compendium base row, applies an explicit contextual percentage adjustment when needed, and stores net active energy above rest.

```sh
npm run cli -- activity add --date 2026-08-09 --text "Swam 1.6 km in 50 minutes, average heart rate 140 bpm"
npm run cli -- activity add --date 2026-08-09 --image ./workout-summary.png
npm run cli -- activity add --text "Use the second interval only" --image ./tracker.png
```

Activity accepts text, one or more uploaded tracker screenshots/photos, or both. Repeat `--image` for multiple files. Images are analyzed but not stored.

## Record medication

```sh
npm run cli -- medication add --date 2026-08-09 --time 09:00 --name "Vitamin D" --dose "1000 IU with food"
```

Medication name, dose or notes, and time are required.

## Delete entries

Obtain IDs with `day show`, then delete by type:

```sh
npm run cli -- food delete --date 2026-08-09 --id ENTRY_ID
npm run cli -- activity delete --date 2026-08-09 --id ENTRY_ID
npm run cli -- medication delete --date 2026-08-09 --id ENTRY_ID
```

## Remote server

```sh
TNT_TRACKER_URL=http://tracker-host:3000 npm run cli -- day show
```

Do not assume that a remote endpoint is authorized. Use a URL supplied or approved by the user.
