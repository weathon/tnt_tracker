import type {FoodEntry} from "./types";

const recorded=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
type Nutrient="proteinG"|"carbsG"|"fatG"|"sodiumMg";

function nutrient(entry:FoodEntry,key:Nutrient):number|undefined{
 const total=key==="sodiumMg"?entry.sodiumMg:entry.macros?.[key];
 if(recorded(total))return total;
 const values=entry.items?.map(item=>item[key]);
 // Use item details only when all items have that nutrient recorded.
 return values?.length&&values.every(recorded)?values.reduce((sum,value)=>sum+value,0):undefined;
}

export function dailyNutrition(foods:readonly FoodEntry[]){
 const sum=(read:(entry:FoodEntry)=>number|undefined)=>{
  let total=0,count=0;
  for(const food of foods){const value=read(food);if(recorded(value)){total+=value;count++}}
  return {value:count>0||foods.length===0?total:null,count};
 };
 return {
  entries:foods.length,
  calories:sum(food=>food.energy),
  proteinG:sum(food=>nutrient(food,"proteinG")),
  carbsG:sum(food=>nutrient(food,"carbsG")),
  fatG:sum(food=>nutrient(food,"fatG")),
  sodiumMg:sum(food=>nutrient(food,"sodiumMg")),
  saltG:sum(food=>{
   if(recorded(food.saltG))return food.saltG;
   const sodium=nutrient(food,"sodiumMg");
   return sodium==null?undefined:sodium/400;
  }),
 };
}
