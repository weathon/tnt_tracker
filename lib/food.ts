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

export function duplicateFoodEntry(entry:FoodEntry,newId:string):FoodEntry{return {...structuredClone(entry),id:newId,createdAt:new Date().toISOString()}}
