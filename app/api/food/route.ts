import {stateResponse,foodForClient} from "@/lib/food-response";
import { NextResponse } from "next/server";
import { z } from "zod";
import { blankDay,readState,updateState } from "@/lib/store";
import type { State } from "@/lib/types";
import { dateSchema,timeSchema } from "@/lib/validation";
import { duplicateFoodEntry,foodEstimateFields,foodPriceFromText,splitFoodEntry } from "@/lib/food";
import { analyzeFood } from "@/lib/food-ai";
import { readFoodImages } from "@/lib/food-images";

const isoDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Use a date in YYYY-MM-DD format").refine(value=>{const parsed=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value},"Use a valid calendar date");
const splitSchema=z.object({action:z.literal("split"),date:isoDateSchema,id:z.string().min(1),otherDate:isoDateSchema});

function submissionResponse(state:State,id:string){
 for(const day of Object.values(state.days)){
  const entry=day.foods.find(food=>food.id===id);
  if(entry)return NextResponse.json(foodForClient(entry));
 }
 return NextResponse.json({error:"This food submission was already saved and later deleted. Refresh the tracker before adding it again."},{status:409});
}

export async function POST(r:Request){try{
  const form=await r.formData();const date=dateSchema.parse(form.get("date"));const time=timeSchema.parse(form.get("time"));const text=String(form.get("text")??"");const priceValue=form.get("price");const explicitPrice=priceValue==null||priceValue===""?foodPriceFromText(text):z.number().finite().nonnegative().parse(Number(priceValue));const files=form.getAll("images") as File[];
  const submissionId=z.uuid().parse(form.get("submissionId")??crypto.randomUUID());
  const mutationId=`food:${submissionId}`;
  if(!text.trim()&&!files.length)throw new Error("Describe your meal or add a photo before submitting.");
  const saved=await readState();
  if(saved.appliedMutationIds?.includes(mutationId))return submissionResponse(saved,submissionId);
  const images=await readFoodImages(files);
  const {result:estimate,raw,energy,macros,sodiumMg,saltG}=await analyzeFood(text,images);
  const createdAt=new Date().toISOString();
  const entry={id:submissionId,...foodEstimateFields(estimate),energy,macros,sodiumMg,saltG,price:explicitPrice??estimate.price??undefined,time,sourceText:text,createdAt,images,analysis:{response:raw,explanation:estimate.explanation,createdAt},conversation:[]};
  const state=await updateState(s=>{const d=s.days[date]??blankDay();d.foods.push(entry);s.days[date]=d},mutationId);
  return submissionResponse(state,submissionId);
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
export async function DELETE(r:Request){try{const {date,id}=await r.json();dateSchema.parse(date);if(typeof id!=="string")throw new Error("Invalid id");return stateResponse(await updateState(s=>{const d=s.days[date];if(d)d.foods=d.foods.filter(x=>x.id!==id)}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
export async function PATCH(r:Request){try{const body=await r.json();if(body?.action==="split"){const {date,id,otherDate}=splitSchema.parse(body);if(otherDate===date)throw new Error("Choose a different day for the other half");return stateResponse(await updateState(s=>{const source=s.days[date];if(!source)throw new Error("Food entry not found");const index=source.foods.findIndex(entry=>entry.id===id);if(index<0)throw new Error("Food entry not found");const [firstHalf,secondHalf]=splitFoodEntry(source.foods[index],crypto.randomUUID());source.foods[index]=firstHalf;const destination=s.days[otherDate]??blankDay();destination.foods.push(secondHalf);s.days[otherDate]=destination}))}const {date,id,newDate,time,userTasteScore,userTasteNote}=body;return stateResponse(await updateState(s=>{const source=s.days[date];if(!source)return;const index=source.foods.findIndex(entry=>entry.id===id);if(index<0)return;if(body?.action==="duplicate"){source.foods.splice(index+1,0,duplicateFoodEntry(source.foods[index],crypto.randomUUID()));return}if(typeof userTasteScore==="number")source.foods[index].userTasteScore=Math.max(1,Math.min(10,Math.round(userTasteScore)));if(typeof userTasteNote==="string"){source.foods[index].userTasteNote=userTasteNote.trim().slice(0,500);return}if(typeof userTasteScore==="number")return;const [entry]=source.foods.splice(index,1);entry.time=time;const destination=s.days[newDate]??blankDay();destination.foods.push(entry);s.days[newDate]=destination}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
