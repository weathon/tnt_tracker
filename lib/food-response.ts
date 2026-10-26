import {NextResponse} from "next/server";
import type {FoodEntry,FoodImage,State} from "./types";

const imageUrls=(images:FoodImage[],query:string)=>images.map((image,index)=>({name:image.name,url:`/api/food/image?${query}&index=${index}`}));

// Photo bytes stay in storage/backups. Normal refreshes carry lazy image URLs
// so a growing photo history doesn't inflate every tracker response.
export function foodForClient(entry:FoodEntry):FoodEntry{
 const query=`id=${encodeURIComponent(entry.id)}`;
 return {
  ...entry,
  ...(entry.images?{images:imageUrls(entry.images,query)}:{}),
  ...(entry.conversation?{conversation:entry.conversation.map(message=>message.images?{...message,images:imageUrls(message.images,`${query}&message=${encodeURIComponent(message.id)}`)}:message)}:{}),
 };
}

export function stateResponse(state:State){
 return NextResponse.json({...state,days:Object.fromEntries(Object.entries(state.days).map(([date,day])=>[date,{...day,foods:day.foods.map(foodForClient)}]))});
}
