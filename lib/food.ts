import { z } from "zod";
import type { FoodEntry } from "./types";

export const foodEstimateSchema=z.object({
  name:z.string().trim().min(1),
  amount:z.string().trim().min(1),
  items:z.array(z.object({name:z.string().trim().min(1),grams:z.number().finite().nonnegative(),kcal_per_100g:z.number().finite().nonnegative(),kcal:z.number().finite().nonnegative(),protein_g:z.number().finite().nonnegative(),carbs_g:z.number().finite().nonnegative(),fat_g:z.number().finite().nonnegative(),sodium_mg:z.number().finite().nonnegative(),confidence:z.enum(["high","medium","low"])})).min(1),
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

const halfAmount = (amount: string) => `Half of ${amount}`;

export function splitFoodEntry(entry: FoodEntry, newId: string): [FoodEntry, FoodEntry] {
  const firstEnergy = entry.energy / 2;
  const shared = { ...entry, amount: halfAmount(entry.amount) };

  return [
    { ...shared, energy: firstEnergy },
    { ...shared, id: newId, energy: entry.energy - firstEnergy },
  ];
}
