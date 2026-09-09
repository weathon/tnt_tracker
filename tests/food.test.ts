import test from "node:test";
import assert from "node:assert/strict";
import { foodEstimateEnergy,foodEstimateSchema,splitFoodEntry } from "../lib/food.ts";

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

test("food estimate total is derived from its itemized calculation",()=>{
 const estimate=foodEstimateSchema.parse({name:"meal",amount:"1 bowl",items:[{name:"tofu",grams:100,kcal_per_100g:80,kcal:80,confidence:"high"},{name:"sauce",grams:20,kcal_per_100g:200,kcal:40,confidence:"low"}],total_kcal:120,total_range:[100,140],macros:{protein_g:8,carbs_g:12,fat_g:5},sodium_mg:300});
 assert.equal(foodEstimateEnergy(estimate),120);
 assert.throws(()=>foodEstimateSchema.parse({...estimate,total_kcal:500}));
});
