import test from "node:test";
import assert from "node:assert/strict";
import { duplicateFoodEntry,foodEstimateEnergy,foodEstimateFields,foodEstimateSchema,foodPriceFromText,splitFoodEntry } from "../lib/food.ts";

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

test("ingredient values alone produce unrounded calories, macros, sodium, and salt",()=>{
 const estimate=foodEstimateSchema.parse({name:"Tofu with sauce",amount:"1 bowl",items:[{name:"tofu",grams:101,kcal_per_100g:80,kcal:80.8,protein_g:6.25,carbs_g:10.5,fat_g:4.15,sodium_mg:100.5,confidence:"high"},{name:"sauce",grams:21,kcal_per_100g:200,kcal:42,protein_g:2.125,carbs_g:2.25,fat_g:1.1,sodium_mg:200.25,confidence:"low"}]});
 const fields=foodEstimateFields(estimate);
 assert.equal(foodEstimateEnergy(estimate),122.8);
 assert.equal(fields.energy,122.8);
 assert.deepEqual(fields.macros,{proteinG:8.375,carbsG:12.75,fatG:5.25});
 assert.equal(fields.sodiumMg,300.75);assert.equal(fields.saltG,300.75/400);
 assert.equal(fields.items[0].proteinG,6.25);assert.equal(fields.items[1].proteinG,2.125);
 assert.equal(fields.energyRange,undefined);
 // An old/extra model total cannot bias saved values.
 const extra=foodEstimateSchema.parse({...estimate,total_kcal:500,total_range:[500,600],macros:{protein_g:99,carbs_g:99,fat_g:99},sodium_mg:9000,salt_g:50});
 assert.deepEqual(foodEstimateFields(extra),fields);
});

test("ingredient nutrition must be present and nonnegative",()=>{
 const item={name:"rice",grams:100,kcal_per_100g:130,kcal:130,protein_g:2.7,carbs_g:28,fat_g:.3,sodium_mg:1,confidence:"medium"};
 assert.throws(()=>foodEstimateSchema.parse({name:"Rice",amount:"1 bowl",items:[{...item,protein_g:undefined}]}));
 assert.throws(()=>foodEstimateSchema.parse({name:"Rice",amount:"1 bowl",items:[{...item,sodium_mg:-1}]}));
});

test("duplicating food preserves the entry details with a new identity",()=>{const entry={id:"original",name:"Toast",amount:"1 slice",energy:90,time:"08:00",createdAt:"old"};const copy=duplicateFoodEntry(entry,"copy");assert.equal(copy.id,"copy");assert.equal(copy.name,entry.name);assert.equal(copy.energy,entry.energy);assert.notEqual(copy.createdAt,entry.createdAt)});
test("food price can be recorded in the meal description",()=>{assert.equal(foodPriceFromText("ramen, price: 18.50"),18.5);assert.equal(foodPriceFromText("Price=0"),0);assert.equal(foodPriceFromText("外卖花了32.5元"),32.5);assert.equal(foodPriceFromText("订单实付 ¥42"),42);assert.equal(foodPriceFromText("ramen"),undefined)});
