import test from "node:test";
import assert from "node:assert/strict";
import { duplicateFoodEntry,foodEstimateEnergy,foodEstimateSchema,foodPriceFromText,splitFoodEntry } from "../lib/food.ts";

test("splitting food creates two equal entries without losing energy", () => {
  const entry = {
    id: "original",
    name: "Midnight snack",
    amount: "1 sandwich",
    energy: 501,
    price: 12.5,
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
  assert.equal(first.price,6.25);
  assert.equal(second.price,6.25);
  assert.equal(first.energy + second.energy, entry.energy);
  assert.equal(first.amount, "Half of 1 sandwich");
  assert.equal(second.amount, "Half of 1 sandwich");
  assert.equal(second.time, entry.time);
  assert.equal(second.userTasteScore, entry.userTasteScore);
  assert.equal(entry.amount, "1 sandwich");
  assert.equal(entry.energy, 501);
  assert.equal(entry.price,12.5);
});

test("food estimate total is derived from its itemized calculation",()=>{
 const estimate=foodEstimateSchema.parse({name:"meal",amount:"1 bowl",items:[{name:"tofu",grams:100,kcal_per_100g:80,kcal:80,protein_g:6,carbs_g:10,fat_g:4,sodium_mg:100,confidence:"high"},{name:"sauce",grams:20,kcal_per_100g:200,kcal:40,protein_g:2,carbs_g:2,fat_g:1,sodium_mg:200,confidence:"low"}],total_kcal:120,total_range:[100,140],macros:{protein_g:8,carbs_g:12,fat_g:5},sodium_mg:300,salt_g:.75});
 assert.equal(foodEstimateEnergy(estimate),120);
 assert.throws(()=>foodEstimateSchema.parse({...estimate,total_kcal:500}));
 assert.throws(()=>foodEstimateSchema.parse({...estimate,salt_g:3}));
 assert.throws(()=>foodEstimateSchema.parse({...estimate,sodium_mg:600,salt_g:1.5}));
});

test("duplicating food preserves the entry details with a new identity",()=>{const entry={id:"original",name:"Toast",amount:"1 slice",energy:90,time:"08:00",createdAt:"old"};const copy=duplicateFoodEntry(entry,"copy");assert.equal(copy.id,"copy");assert.equal(copy.name,entry.name);assert.equal(copy.energy,entry.energy);assert.notEqual(copy.createdAt,entry.createdAt)});
test("food price can be recorded in the meal description",()=>{assert.equal(foodPriceFromText("ramen, price: 18.50"),18.5);assert.equal(foodPriceFromText("Price=0"),0);assert.equal(foodPriceFromText("外卖花了32.5元"),32.5);assert.equal(foodPriceFromText("订单实付 ¥42"),42);assert.equal(foodPriceFromText("ramen"),undefined)});
