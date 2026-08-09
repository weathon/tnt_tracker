import { z } from "zod";
export const foodResult = z.object({items:z.array(z.object({name:z.string().min(1),amount:z.string().min(1),energy_kcal:z.number().nonnegative()})).min(1)});
export const activityResult = z.object({activities:z.array(z.object({name:z.string().min(1),duration:z.string().min(1),duration_minutes:z.number().min(1).max(1440),compendium_code:z.string().regex(/^\d{5}$/),met:z.number().gt(1),active_energy_kcal:z.number().nonnegative()})).min(1)});
export type ImageInput={mime:string;base64:string};
export function foodContent(text:string, images:ImageInput[]) { return [{type:"text",text:`Analyze this meal. ${text ? `User description: ${text}` : "There is no text description."} Estimate each detected food's amount and dietary energy in kilocalories. Return JSON only.`},...images.map(i=>({type:"image_url",image_url:{url:`data:${i.mime};base64,${i.base64}`}}))]; }
export async function askOpenRouter(content:unknown, schema:unknown, name:string) {
 const key=process.env.OPENROUTER_API_KEY; if(!key) throw new Error("OPENROUTER_API_KEY is not configured");
 const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"openai/gpt-5.6-terra",messages:[{role:"user",content}],response_format:{type:"json_schema",json_schema:{name,strict:true,schema}}})});
 if(!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
 const body=await res.json(); const raw=body?.choices?.[0]?.message?.content; if(typeof raw!=="string") throw new Error("OpenRouter returned no structured content");
 try{return JSON.parse(raw)}catch{throw new Error("OpenRouter returned invalid JSON")}
}
export const foodJsonSchema={type:"object",additionalProperties:false,properties:{items:{type:"array",minItems:1,items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},amount:{type:"string"},energy_kcal:{type:"number",minimum:0}},required:["name","amount","energy_kcal"]}}},required:["items"]};
export const activityJsonSchema={type:"object",additionalProperties:false,properties:{activities:{type:"array",minItems:1,items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},duration:{type:"string"},duration_minutes:{type:"number",minimum:1,maximum:1440},compendium_code:{type:"string",pattern:"^[0-9]{5}$"},met:{type:"number",exclusiveMinimum:1},active_energy_kcal:{type:"number",minimum:0}},required:["name","duration","duration_minutes","compendium_code","met","active_energy_kcal"]}}},required:["activities"]};
