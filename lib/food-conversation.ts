import {z} from "zod";
import {foodEstimateFields,foodEstimateSchema} from "./food";
import type {FoodEntry,State} from "./types";

export const foodFollowUpSchema=z.object({
 reply:z.string().trim().min(1).max(20000),
 update:foodEstimateSchema.nullable(),
});

export class FoodConversationError extends Error{
 constructor(message:string,public status:number){super(message)}
}

export function findFood(state:State,id:string){
 for(const [date,day] of Object.entries(state.days)){
  const entry=day.foods.find(food=>food.id===id);
  if(entry)return {date,entry};
 }
 throw new FoodConversationError("This food entry no longer exists.",404);
}

// Ratings and date/time edits can proceed while the model works. Changes to
// the estimate or its conversation must invalidate the pending model result.
export function foodConversationVersion(entry:FoodEntry){
 const {time: _time,userTasteScore: _score,userTasteNote: _note,tasteScore: _taste,...context}=entry;
 return JSON.stringify(context);
}

export function applyFoodFollowUp(state:State,id:string,version:string,submissionId:string,question:string,result:z.infer<typeof foodFollowUpSchema>,response:string){
 const {entry}=findFood(state,id);
 if(foodConversationVersion(entry)!==version)throw new FoodConversationError("This meal changed while the reply was being prepared. Please send your question again using the latest entry.",409);
 if(result.update)Object.assign(entry,foodEstimateFields(result.update));
 const createdAt=new Date().toISOString();
 (entry.conversation??=[]).push(
  {id:`${submissionId}:user`,role:"user",content:question,createdAt},
  {id:`${submissionId}:assistant`,role:"assistant",content:result.reply,createdAt,updatedEntry:result.update!==null,response},
 );
 return entry;
}
