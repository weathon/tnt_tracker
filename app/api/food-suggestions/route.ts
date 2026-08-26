import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(r:Request){try{
  const {recentFoods}=await r.json();
  const recentList=Array.isArray(recentFoods)?recentFoods.map((f:string)=>f).join(", "):"none logged";
  const schema={type:"object",additionalProperties:false,properties:{suggestions:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},why_healthy:{type:"string"},why_tasty:{type:"string"},health_score:{type:"number"},taste_score:{type:"number"}},required:["name","why_healthy","why_tasty","health_score","taste_score"]}}},required:["suggestions"]};
  const content=[{type:"text",text:`Suggest 6 foods that are both healthy AND delicious. Consider overall nutrition (vitamins, minerals, fiber, protein, healthy fats, antioxidants, low processing) not just calories. Each food should score at least 7/10 on both health and taste. Provide variety across categories (fruits, proteins, grains, vegetables, snacks, meals). The user recently ate: ${recentList}. Avoid repeating those and suggest complementary nutrition. Return JSON matching this schema:\n${JSON.stringify(schema,null,2)}`}];
  const key=process.env.OPENROUTER_API_KEY;if(!key)throw new Error("OPENROUTER_API_KEY is not configured");
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.7-flash",reasoning:{effort:"high"},messages:[{role:"user",content}],response_format:{type:"json_schema",json_schema:{name:"food_suggestions",strict:true,schema}},provider:{require_parameters:true},plugins:[{id:"response-healing"}],stream:false})});
  if(!response.ok)throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  const body=await response.json();const raw=body?.choices?.[0]?.message?.content;if(typeof raw!=="string")throw new Error("No structured content returned");
  const parsed=z.object({suggestions:z.array(z.object({name:z.string(),why_healthy:z.string(),why_tasty:z.string(),health_score:z.number(),taste_score:z.number()}))}).parse(JSON.parse(raw));
  return NextResponse.json(parsed);
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:400})}}
