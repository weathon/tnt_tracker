import { z } from "zod";
import type { FoodEntry } from "./types";

export const foodEstimateSchema=z.object({
  name:z.string().trim().min(1),
  amount:z.string().trim().min(1),
  price:z.number().finite().nonnegative().nullable().optional(),
  items:z.array(z.object({name:z.string().trim().min(1),price:z.number().finite().nonnegative().nullable().optional(),grams:z.number().finite().nonnegative(),kcal_per_100g:z.number().finite().nonnegative(),kcal:z.number().finite().nonnegative(),protein_g:z.number().finite().nonnegative(),carbs_g:z.number().finite().nonnegative(),fat_g:z.number().finite().nonnegative(),sodium_mg:z.number().finite().nonnegative(),confidence:z.enum(["high","medium","low"])})).min(1),
  total_kcal:z.number().finite().nonnegative(),
  total_range:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative()]),
  macros:z.object({protein_g:z.number().finite().nonnegative(),carbs_g:z.number().finite().nonnegative(),fat_g:z.number().finite().nonnegative()}),
  sodium_mg:z.number().finite().nonnegative(),
  salt_g:z.number().finite().nonnegative(),
}).superRefine((estimate,ctx)=>{
  if(estimate.total_range[0]>estimate.total_range[1])ctx.addIssue({code:"custom",message:"total_range must be ordered"});
  const itemTotal=estimate.items.reduce((total,item)=>total+item.kcal,0);
  if(Math.abs(itemTotal-estimate.total_kcal)>1)ctx.addIssue({code:"custom",message:"total_kcal must equal the sum of item kcal values"});
  const nutrientTotal=estimate.items.reduce((total,item)=>({protein_g:total.protein_g+item.protein_g,carbs_g:total.carbs_g+item.carbs_g,fat_g:total.fat_g+item.fat_g,sodium_mg:total.sodium_mg+item.sodium_mg}),{protein_g:0,carbs_g:0,fat_g:0,sodium_mg:0});
  if(["protein_g","carbs_g","fat_g"].some(key=>Math.abs(estimate.macros[key as keyof typeof estimate.macros]-nutrientTotal[key as keyof typeof nutrientTotal])>1)||Math.abs(estimate.sodium_mg-nutrientTotal.sodium_mg)>1)ctx.addIssue({code:"custom",message:"meal macros and sodium must equal the sum of item values"});
  if(Math.abs(estimate.salt_g-estimate.sodium_mg/400)>0.05)ctx.addIssue({code:"custom",message:"salt_g must be sodium_mg divided by 400"});
});

export type FoodEstimate=z.infer<typeof foodEstimateSchema>;
export function foodEstimateEnergy(estimate:FoodEstimate){return estimate.items.reduce((total,item)=>total+item.kcal,0)}
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
