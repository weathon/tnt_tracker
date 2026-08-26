import { NextResponse } from "next/server";
import { z } from "zod";

type HistoryEntry = { name: string; healthScore?: number; userTasteScore?: number; tasteScore?: number };

export async function POST(r:Request){try{
  const {history}=await r.json() as {history:HistoryEntry[]};
  const entries=Array.isArray(history)?history:[];
  const historyText=entries.length?entries.map(f=>{const taste=f.userTasteScore??f.tasteScore;return `${f.name}${taste!=null?` (user taste: ${taste}/10)`:""}${f.healthScore!=null?` (health: ${f.healthScore}/10)`:""}`}).join("\n"):"No food history available.";
  const schema={type:"object",additionalProperties:false,properties:{suggestions:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},why_healthy:{type:"string"},why_tasty:{type:"string"},health_score:{type:"number"},predicted_taste_score:{type:"number"}},required:["name","why_healthy","why_tasty","health_score","predicted_taste_score"]}}},required:["suggestions"]};
  const content=[{type:"text",text:`You are a food recommendation engine. The user has the following food history with their personal taste ratings and health scores:\n\n${historyText}\n\nAnalyze the user's taste preferences from their ratings. Foods they rated highly (8-10) indicate what flavors, textures, cuisines, and food types they enjoy. Foods rated low (1-4) indicate dislikes.\n\nSuggest 6 foods that are both healthy AND would appeal to THIS specific user's taste preferences. Consider overall nutrition (vitamins, minerals, fiber, protein, healthy fats, antioxidants, low processing) not just calories. Each food should score at least 7/10 on health. For predicted_taste_score, estimate how much this specific user would enjoy it based on their rating patterns (not general population taste). Provide variety across categories (fruits, proteins, grains, vegetables, snacks, meals). Avoid repeating foods already in their history and suggest complementary nutrition to fill gaps.\n\nReturn JSON matching this schema:\n${JSON.stringify(schema,null,2)}`}];
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw new Error("OPENROUTER_API_KEY is not configured");
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.7-flash",reasoning:{effort:"high"},messages:[{role:"user",content}],response_format:{type:"json_schema",json_schema:{name:"food_suggestions",strict:true,schema}},provider:{require_parameters:true},plugins:[{id:"response-healing"}],stream:false})});
  if(!response.ok)throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  const body=await response.json();const raw=body?.choices?.[0]?.message?.content;if(typeof raw!=="string")throw new Error("No structured content returned");
  const parsed=z.object({suggestions:z.array(z.object({name:z.string(),why_healthy:z.string(),why_tasty:z.string(),health_score:z.number(),predicted_taste_score:z.number()}))}).parse(JSON.parse(raw));
  return NextResponse.json(parsed);
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
