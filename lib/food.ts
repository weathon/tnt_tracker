import { z } from "zod";
import type { FoodEntry } from "./types";

export const foodEstimateSchema=z.object({
  name:z.string().trim().min(1),
  amount:z.string().trim().min(1),
  items:z.array(z.object({name:z.string().trim().min(1),grams:z.number().finite().nonnegative(),kcal_per_100g:z.number().finite().nonnegative(),kcal:z.number().finite().nonnegative(),confidence:z.enum(["high","medium","low"])})).min(1),
  total_kcal:z.number().finite().nonnegative(),
  total_range:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative()]),
}).superRefine((estimate,ctx)=>{
  if(estimate.total_range[0]>estimate.total_range[1])ctx.addIssue({code:"custom",message:"total_range must be ordered"});
  const itemTotal=estimate.items.reduce((total,item)=>total+item.kcal,0);
  if(Math.abs(itemTotal-estimate.total_kcal)>1)ctx.addIssue({code:"custom",message:"total_kcal must equal the sum of item kcal values"});
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
