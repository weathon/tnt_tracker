import {foodAnalysisJsonSchema,foodFollowUpJsonSchema} from "../lib/food-ai-schema.ts";
import test from "node:test";import assert from "node:assert/strict";import {foodAnalysisPrompt,foodContent,foodSuggestionPrompt,summarizeFoodHistory} from "../lib/ai.ts";
test("food payload places prompt before all base64 images",()=>{const c=foodContent("rice",[{mime:"image/png",base64:"aaa"},{mime:"image/jpeg",base64:"bbb"}]);assert.equal(c[0].type,"text");assert.match((c[0] as {text:string}).text,/rice/);assert.deepEqual(c.slice(1).map((x:any)=>x.image_url.url),["data:image/png;base64,aaa","data:image/jpeg;base64,bbb"])});
test("food analysis keeps logged fields in the user's typed language",()=>{const prompt=foodAnalysisPrompt("叉烧饭，加一个蛋",{});assert.match(prompt,/same language and script/);assert.match(prompt,/Do not translate or romanize them into English/);assert.match(prompt,/叉烧饭，加一个蛋/)});
test("food analysis estimates ingredient macros independently without model totals",()=>{const prompt=foodAnalysisPrompt("mixed vegetables",{});assert.match(prompt,/Break each dish down into its identifiable ingredients/);assert.match(prompt,/Estimate every ingredient independently/);assert.match(prompt,/Do not choose a meal total first/);assert.match(prompt,/Do not calculate or output combined calories/);assert.match(prompt,/The application alone sums ingredient values/);assert.match(prompt,/Do not adjust ingredient quantities, energy, or macros to match a target/);assert.match(prompt,/sodium_mg is elemental sodium/)});
test("non-food analysis uses chemical components and retains Landauer calculations",()=>{const prompt=foodAnalysisPrompt("32GB of model weights",{});assert.match(prompt,/non-food physical objects/);assert.match(prompt,/chemical composition/);assert.match(prompt,/Landauer's principle/);assert.match(prompt,/2\.8725 × 10⁻²¹ J/);assert.match(prompt,/inert materials/)});
test("station platter remains a non-food complete-combustion analysis",()=>{const stations="车站拼盘:温哥华中央太平洋车站, 温哥华水滨车站, 香港西九龙车站, 广州北站, 西雅图国王街车站, 纽约中央车站, 北京北站";const prompt=foodAnalysisPrompt(stations,{});assert.match(prompt,/complete-combustion energy density/);assert.match(prompt,/Each item is a constituent material or compound/);assert.match(prompt,/车站拼盘/)});
test("food history summarizes repeat meals and ratings without losing original language",()=>{const summary=summarizeFoodHistory([{name:"Char siu rice",sourceText:"叉烧饭",userTasteScore:9},{name:"char siu rice",sourceText:"叉烧饭加蛋",userTasteScore:10},{name:"Congee",sourceText:"皮蛋瘦肉粥"}]);assert.equal(summary.length,2);assert.deepEqual(summary[0],{name:"Char siu rice",originalDescriptions:["叉烧饭","叉烧饭加蛋"],timesLogged:2,tasteRating:{average:9.5,count:2,minimum:9,maximum:10}});assert.equal(summary[1].timesLogged,1)});
test("food suggestions prioritize demonstrated cuisine instead of Western defaults",()=>{const prompt=foodSuggestionPrompt(summarizeFoodHistory([{name:"Char siu rice",sourceText:"叉烧饭",userTasteScore:10}]),{});assert.match(prompt,/Do not default to Western food/);assert.match(prompt,/At least 4 of the 6 suggestions/);assert.match(prompt,/originalDescriptions/);assert.match(prompt,/叉烧饭/)});


test("initial analysis and follow-up schemas request ingredient nutrition only",()=>{
 for(const schema of [foodAnalysisJsonSchema,foodFollowUpJsonSchema.properties.update.anyOf[0]]){
  assert.ok("properties" in schema);
  assert.ok("additionalProperties" in schema);
  const properties=schema.properties as Record<string,any>;
  for(const name of ["total_kcal","total_range","macros","sodium_mg","salt_g"])assert.equal(name in properties,false,name);
  assert.equal(schema.additionalProperties,false);
  for(const name of ["protein_g","carbs_g","fat_g","sodium_mg"])assert.ok(properties.items.items.required.includes(name));
 }
});
