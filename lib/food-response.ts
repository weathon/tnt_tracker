import {NextResponse} from "next/server";
import type {FoodEntry,State} from "./types";

// Photo bytes stay in storage/backups. Normal refreshes carry lazy image URLs
// so a growing photo history doesn't inflate every tracker response.
export function foodForClient(entry:FoodEntry):FoodEntry{
 return {...entry,...(entry.images?{images:entry.images.map((image,index)=>({name:image.name,url:`/api/food/image?id=${encodeURIComponent(entry.id)}&index=${index}`}))}:{})};
}

export function stateResponse(state:State){
 return NextResponse.json({...state,days:Object.fromEntries(Object.entries(state.days).map(([date,day])=>[date,{...day,foods:day.foods.map(foodForClient)}]))});
}
