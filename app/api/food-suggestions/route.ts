import { NextResponse } from "next/server";
import { z } from "zod";

type HistoryEntry = { name: string; userTasteScore?: number; tasteScore?: number };

export async function POST(r:Request){try{
  const {history}=await r.json() as {history:HistoryEntry[]};
  const entries=Array.isArray(history)?history:[];
  const historyText=entries.length?entries.map(f=>{const taste=f.userTasteScore??f.tasteScore;return `${f.name}${taste!=null?` (taste rating: ${taste}/10)`:""}`}).join("\n"):"No food history available.";
  const schema={type:"object",additionalProperties:false,properties:{suggestions:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},why_healthy:{type:"string"},why_youd_like_it:{type:"string"},predicted_taste_score:{type:"number"}},required:["name","why_healthy","why_youd_like_it","predicted_taste_score"]}}},required:["suggestions"]};
  const content=[{type:"text",text:`You are a food recommendation engine. The user has logged these foods with their personal taste ratings:\n\n${historyText}\n\nAnalyze what this person likes based on their taste ratings. Foods rated 8-10 show what flavors, textures, cuisines, and food types they enjoy. Foods rated 1-4 show dislikes. Unrated foods are neutral.\n\nSuggest 6 foods that are genuinely healthy AND that this specific person would enjoy based on their taste patterns. Focus on nutrient-dense, minimally processed options (rich in vitamins, minerals, fiber, protein, healthy fats). For predicted_taste_score, estimate how much THIS user would enjoy it based on their rating history, not general population taste. Provide variety across categories (fruits, proteins, grains, vegetables, snacks, full meals). Avoid repeating foods from their history.\n\nReturn JSON matching this schema:\n${JSON.stringify(schema,null,2)}`}];
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw new Error("OPENROUTER_API_KEY is not configured");
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.7-flash",reasoning:{effort:"high"},messages:[{role:"user",content}],response_format:{type:"json_schema",json_schema:{name:"food_suggestions",strict:true,schema}},provider:{require_parameters:true},plugins:[{id:"response-healing"}],stream:false})});
  if(!response.ok)throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  const body=await response.json();const raw=body?.choices?.[0]?.message?.content;if(typeof raw!=="string")throw new Error("No structured content returned");
  const parsed=z.object({suggestions:z.array(z.object({name:z.string(),why_healthy:z.string(),why_youd_like_it:z.string(),predicted_taste_score:z.number()}))}).parse(JSON.parse(raw));
  return NextResponse.json(parsed);
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
