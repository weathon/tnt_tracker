import { z } from "zod";
import type { FoodEntry } from "./types";

export const foodEstimateSchema=z.object({
  name:z.string().trim().min(1),
  amount:z.string().trim().min(1),
  price:z.number().finite().nonnegative().nullable().optional(),
  items:z.array(z.object({name:z.string().trim().min(1),price:z.number().finite().nonnegative().nullable().optional(),grams:z.number().finite().nonnegative(),kcal_per_100g:z.number().finite().nonnegative(),kcal:z.number().finite().nonnegative(),protein_g:z.number().finite().nonnegative(),carbs_g:z.number().finite().nonnegative(),fat_g:z.number().finite().nonnegative(),sodium_mg:z.number().finite().nonnegative(),confidence:z.enum(["high","medium","low"])})).min(1),
});

export type FoodEstimate=z.infer<typeof foodEstimateSchema>;
export function foodEstimateEnergy(estimate:FoodEstimate){return estimate.items.reduce((total,item)=>total+item.kcal,0)}
// Only these fields may be changed by a food-analysis follow-up.
export function foodEstimateFields(estimate:FoodEstimate){
 const nutrients=estimate.items.reduce((sum,item)=>({proteinG:sum.proteinG+item.protein_g,carbsG:sum.carbsG+item.carbs_g,fatG:sum.fatG+item.fat_g,sodiumMg:sum.sodiumMg+item.sodium_mg}),{proteinG:0,carbsG:0,fatG:0,sodiumMg:0});
 return {
  name:estimate.name,amount:estimate.amount,energy:foodEstimateEnergy(estimate),
  price:estimate.price??undefined,
  items:estimate.items.map(item=>({name:item.name,price:item.price??undefined,grams:item.grams,kcalPer100g:item.kcal_per_100g,energy:item.kcal,proteinG:item.protein_g,carbsG:item.carbs_g,fatG:item.fat_g,sodiumMg:item.sodium_mg,confidence:item.confidence})),
  // An updated ingredient estimate invalidates any legacy model-supplied range.
  energyRange:undefined,
  macros:{proteinG:nutrients.proteinG,carbsG:nutrients.carbsG,fatG:nutrients.fatG},
  sodiumMg:nutrients.sodiumMg,saltG:nutrients.sodiumMg/400,
 };
}
// A two-model entry keeps only the first model's items; its totals average
// both. Returns each model's estimate scaled to the entry's current portion,
// or undefined once the entry no longer matches that original average.
export function foodModelBreakdowns(entry:FoodEntry){
 if(!entry.items||!entry.macros||entry.sodiumMg==null||!entry.analysis?.response||entry.conversation?.some(message=>message.updatedEntry))return undefined;
 const saved=JSON.parse(entry.analysis.response);
 if(!Array.isArray(saved)||saved.length!==2)return undefined;
 const original=saved.map((analysis:{model:string;response:unknown})=>{
  const {items,energy,macros,sodiumMg,saltG}=foodEstimateFields(foodEstimateSchema.parse(analysis.response));
  return {model:analysis.model,items,energy,macros,sodiumMg,saltG};
 });
 const factor=entry.items.reduce((sum,item)=>sum+item.energy,0)/original[0].energy;
 if(!(Number.isFinite(factor)&&entry.items.length===original[0].items.length&&entry.items.every((item,index)=>{
  const first=original[0].items[index];
  return item.name===first.name&&(["grams","energy","proteinG","carbsG","fatG","sodiumMg"] as const).every(key=>Math.abs(item[key]!-first[key]!*factor)<1e-7);
 })&&Math.abs(entry.energy-(original[0].energy+original[1].energy)*factor/2)<1e-7&&(["proteinG","carbsG","fatG"] as const).every(key=>Math.abs(entry.macros![key]-(original[0].macros[key]+original[1].macros[key])*factor/2)<1e-7)&&Math.abs(entry.sodiumMg-(original[0].sodiumMg+original[1].sodiumMg)*factor/2)<1e-7))return undefined;
 return original.map(breakdown=>({
  model:breakdown.model,energy:breakdown.energy*factor,
  macros:{proteinG:breakdown.macros.proteinG*factor,carbsG:breakdown.macros.carbsG*factor,fatG:breakdown.macros.fatG*factor},
  sodiumMg:breakdown.sodiumMg*factor,saltG:breakdown.saltG*factor,
  items:breakdown.items.map(item=>({...item,grams:item.grams*factor,energy:item.energy*factor,price:item.price==null?undefined:item.price*factor,proteinG:item.proteinG*factor,carbsG:item.carbsG*factor,fatG:item.fatG*factor,sodiumMg:item.sodiumMg*factor})),
 }));
}
export function foodPriceFromText(text:string){
 const patterns=[
  /(?:^|[\s,;])price\s*[:=]\s*([$¥￥]?\s*\d+(?:\.\d{1,2})?)(?:\s|$)/i,
  /(?:[$¥￥]\s*)(\d+(?:\.\d{1,2})?)/,
  /(?:花了|花费|消费|实付|支付|付款|一共|总计)\s*(?:人民币|rmb|cny|cad|元|块|[$¥￥])?\s*(\d+(?:\.\d{1,2})?)/i,
  /(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块|人民币|rmb|cny|cad)/i,
 ];
 for(const pattern of patterns){const match=text.match(pattern);if(match){const value=Number(match[1].replace(/[$¥￥\s]/g,""));if(Number.isFinite(value)&&value>=0)return value}}
 return undefined;
}

const halfAmount = (amount: string) => `Half of ${amount}`;

export function splitFoodEntry(entry: FoodEntry, newId: string): [FoodEntry, FoodEntry] {
  const half=(value:number|undefined)=>value==null?undefined:value/2;
  const first:FoodEntry={
    ...entry,amount:halfAmount(entry.amount),energy:entry.energy/2,price:half(entry.price),
    macros:entry.macros&&{proteinG:entry.macros.proteinG/2,carbsG:entry.macros.carbsG/2,fatG:entry.macros.fatG/2},
    sodiumMg:half(entry.sodiumMg),saltG:half(entry.saltG),
    energyRange:entry.energyRange&&[entry.energyRange[0]/2,entry.energyRange[1]/2],
    items:entry.items?.map(item=>({...item,grams:item.grams/2,energy:item.energy/2,price:half(item.price),proteinG:half(item.proteinG),carbsG:half(item.carbsG),fatG:half(item.fatG),sodiumMg:half(item.sodiumMg)})),
  };
  return [first,{...structuredClone(first),id:newId}];
}

// The copy is logged at the time it was duplicated when that time is given.
export function duplicateFoodEntry(entry:FoodEntry,newId:string,time?:string):FoodEntry{return {...structuredClone(entry),id:newId,createdAt:new Date().toISOString(),...(time?{time}:{})}}
