import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import DailyNutrition from "../app/daily-nutrition.tsx";
import {dailyNutrition} from "../lib/nutrition.ts";
import {duplicateFoodEntry,splitFoodEntry} from "../lib/food.ts";
import type {FoodEntry} from "../lib/types.ts";

const meal:FoodEntry={
 id:"meal",name:"Lunch",amount:"1 bowl",energy:600,time:"12:00",createdAt:"2026-09-14T12:00:00Z",
 macros:{proteinG:20.5,carbsG:70,fatG:20},sodiumMg:1200,saltG:3,energyRange:[500,700],
 items:[{name:"Rice bowl",grams:300,kcalPer100g:200,energy:600,proteinG:20.5,carbsG:70,fatG:20,sodiumMg:1200,confidence:"medium"}],
};

test("daily totals sum meals without counting their item details twice",()=>{
 const other:FoodEntry={id:"snack",name:"Snack",amount:"1 portion",energy:200,createdAt:"today",macros:{proteinG:10.25,carbsG:30,fatG:5},sodiumMg:200,saltG:.5};
 const totals=dailyNutrition([meal,other]);
 assert.equal(totals.entries,2);
 assert.deepEqual(totals.calories,{value:800,count:2});
 assert.deepEqual(totals.proteinG,{value:30.75,count:2});
 assert.equal(totals.carbsG.value,100);
 assert.equal(totals.fatG.value,25);
 assert.equal(totals.sodiumMg.value,1400);
 assert.equal(totals.saltG.value,3.5);
});

test("missing nutrients stay unknown while recorded zeroes count as complete",()=>{
 const old:FoodEntry={id:"old",name:"Older meal",amount:"1 portion",energy:100,createdAt:"old"};
 const unknown=dailyNutrition([old]);
 assert.deepEqual(unknown.proteinG,{value:null,count:0});
 const partial=dailyNutrition([meal,old]);
 assert.deepEqual(partial.calories,{value:700,count:2});
 assert.deepEqual(partial.proteinG,{value:20.5,count:1});
 const zero=dailyNutrition([{...old,macros:{proteinG:0,carbsG:0,fatG:0},sodiumMg:0,saltG:0}]);
 assert.deepEqual(zero.proteinG,{value:0,count:1});
 assert.deepEqual(zero.saltG,{value:0,count:1});
});

test("complete item details fill absent meal totals and sodium supplies salt equivalent",()=>{
 const totals=dailyNutrition([{...meal,macros:undefined,sodiumMg:undefined,saltG:undefined}]);
 assert.deepEqual(totals.proteinG,{value:20.5,count:1});
 assert.deepEqual(totals.sodiumMg,{value:1200,count:1});
 assert.deepEqual(totals.saltG,{value:3,count:1});
 const incomplete=dailyNutrition([{...meal,macros:undefined,items:[meal.items![0],{name:"Sauce",grams:10,kcalPer100g:100,energy:10,confidence:"low"}]}]);
 assert.deepEqual(incomplete.proteinG,{value:null,count:0});
});

test("splitting between days halves all nutrition and preserves the original combined total",()=>{
 const original=structuredClone(meal);
 const [first,second]=splitFoodEntry(meal,"other-day");
 const full=dailyNutrition([meal]);
 for(const entry of [first,second]){
  const half=dailyNutrition([entry]);
  for(const key of ["calories","proteinG","carbsG","fatG","sodiumMg","saltG"] as const){
   assert.equal(half[key].value,full[key].value!/2,key);
  }
  assert.deepEqual(entry.energyRange,[250,350]);
  assert.equal(entry.items![0].grams,150);
  assert.equal(entry.items![0].energy,300);
  assert.equal(entry.items![0].kcalPer100g,200);
  assert.equal(entry.items![0].proteinG,10.25);
  assert.equal(entry.items![0].carbsG,35);
  assert.equal(entry.items![0].fatG,10);
  assert.equal(entry.items![0].sodiumMg,600);
 }
 const combined=dailyNutrition([first,second]);
 for(const key of ["calories","proteinG","carbsG","fatG","sodiumMg","saltG"] as const)assert.equal(combined[key].value,full[key].value,key);
 assert.deepEqual(meal,original);
});

test("totals follow the current day's entries after duplication, deletion, or selecting an empty day",()=>{
 const copy=duplicateFoodEntry(meal,"copy");
 assert.equal(dailyNutrition([meal,copy]).proteinG.value,41);
 assert.equal(dailyNutrition([meal]).proteinG.value,20.5);
 const empty=dailyNutrition([]);
 assert.equal(empty.entries,0);
 assert.deepEqual(empty.proteinG,{value:0,count:0});
 assert.deepEqual(empty.calories,{value:0,count:0});
});

test("the summary labels the selected day and makes partial totals visible",()=>{
 const older:FoodEntry={id:"old",name:"Older meal",amount:"1 portion",energy:100,createdAt:"old"};
 const html=renderToStaticMarkup(createElement(DailyNutrition,{date:"2026-09-14",foods:[meal,older]}));
 assert.match(html,/Daily nutrition/);
 assert.match(html,/<time dateTime="2026-09-14">2026-09-14<\/time>/);
 for(const label of ["Calories","Protein","Carbs","Fat","Sodium","Salt"])assert.ok(html.includes(`<dt>${label}</dt>`));
 assert.match(html,/1 of 2 entries/);
 assert.match(html,/some entries are missing nutrient details/);
 const empty=renderToStaticMarkup(createElement(DailyNutrition,{date:"2026-09-15",foods:[]}));
 assert.match(empty,/No food logged for this day/);
 assert.doesNotMatch(empty,/Not recorded/);
});
