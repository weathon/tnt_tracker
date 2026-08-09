import { readFile, writeFile } from "node:fs/promises";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/import-met-compendium.mjs input.txt output.json");

const lines = (await readFile(input, "utf8")).split(/\r?\n/);
const rows = [];
let current = null;
for (const raw of lines) {
  const line = raw.replace(/\f/g, "").trimEnd();
  const match = line.match(/^\s*(.*?)\s+(\d{5})\s+(\d+(?:\.\d+)?)(?:\s+(.*))?$/);
  if (match) {
    current = { category: match[1].trim(), code: match[2], met: Number(match[3]), description: (match[4] ?? "").trim() };
    rows.push(current);
  } else if (current && line.trim() && !/2024 Adult Compendium|Major Heading|Activity Code|MET Value|Activity Description/.test(line)) {
    current.description += ` ${line.trim()}`;
  }
}

await writeFile(output, JSON.stringify({
  source: "2024 Adult Compendium of Physical Activities",
  url: "https://pacompendium.com/adult-compendium/",
  rows
}, null, 2) + "\n");
console.log(`Imported ${rows.length} MET rows`);
