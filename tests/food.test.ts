import test from "node:test";
import assert from "node:assert/strict";
import { splitFoodEntry } from "../lib/food.ts";

test("splitting food creates two equal entries without losing energy", () => {
  const entry = {
    id: "original",
    name: "Midnight snack",
    amount: "1 sandwich",
    energy: 501,
    time: "00:05",
    sourceText: "sandwich",
    userTasteScore: 8,
    createdAt: "2026-08-29T07:05:00.000Z",
  };

  const [first, second] = splitFoodEntry(entry, "other-half");

  assert.equal(first.id, "original");
  assert.equal(second.id, "other-half");
  assert.equal(first.energy, 250.5);
  assert.equal(second.energy, 250.5);
  assert.equal(first.energy + second.energy, entry.energy);
  assert.equal(first.amount, "Half of 1 sandwich");
  assert.equal(second.amount, "Half of 1 sandwich");
  assert.equal(second.time, entry.time);
  assert.equal(second.userTasteScore, entry.userTasteScore);
  assert.equal(entry.amount, "1 sandwich");
  assert.equal(entry.energy, 501);
});
