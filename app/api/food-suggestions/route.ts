import { NextResponse } from "next/server";
import { z } from "zod";
import { foodSuggestionPrompt,summarizeFoodHistory,type FoodHistoryInput } from "@/lib/ai";

const historyEntrySchema=z.object({name:z.string(),sourceText:z.string().optional(),userTasteScore:z.number().optional(),tasteScore:z.number().optional()});

export async function POST(r:Request){try{
  const requestBody=await r.json() as {history?:unknown};
  const entries=Array.isArray(requestBody.history)?requestBody.history.map(entry=>historyEntrySchema.safeParse(entry)).flatMap(result=>result.success?[result.data]:[]) as FoodHistoryInput[]:[];
  const history=summarizeFoodHistory(entries);
  const schema={type:"object",additionalProperties:false,properties:{suggestions:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},why_healthy:{type:"string"},why_youd_like_it:{type:"string"},predicted_taste_score:{type:"number"}},required:["name","why_healthy","why_youd_like_it","predicted_taste_score"]}}},required:["suggestions"]};
  const content=[{type:"text",text:foodSuggestionPrompt(history,schema)}];
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw new Error("OPENROUTER_API_KEY is not configured");
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.7-flash",reasoning:{effort:"high"},messages:[{role:"user",content}],response_format:{type:"json_schema",json_schema:{name:"food_suggestions",strict:true,schema}},provider:{require_parameters:true},plugins:[{id:"response-healing"}],stream:false})});
  if(!response.ok)throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  const body=await response.json();const raw=body?.choices?.[0]?.message?.content;if(typeof raw!=="string")throw new Error("No structured content returned");
  const parsed=z.object({suggestions:z.array(z.object({name:z.string(),why_healthy:z.string(),why_youd_like_it:z.string(),predicted_taste_score:z.number()}))}).parse(JSON.parse(raw));
  return NextResponse.json(parsed);
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
