import { NextResponse } from "next/server";
import { activityJsonSchema,activityResult,askOpenRouter, type ImageInput } from "@/lib/ai";
import { blankDay,readState,updateState } from "@/lib/store";
import { dateSchema } from "@/lib/validation";
import type { Profile } from "@/lib/types";
import { metCandidates, type MetRow } from "@/lib/met";

const allowedImages=new Set(["image/jpeg","image/png","image/webp","image/gif"]);const maxImageSize=10*1024*1024;
const prompt=(text:string,p:Profile,candidates:MetRow[])=>`Analyze the activity description and any attached activity photos or tracker screenshots. Extract visible duration, distance, pace, steps, terrain, load, and heart rate when relevant. Split the input into distinct physical activities. For each one, choose one best base activity from the supplied official 2024 Adult Compendium rows when the match is clear. When the described pace or intensity genuinely falls between two neighboring rows for the same movement, choose those two surrounding rows in base_reference_codes and use their arithmetic mean as base_met. Never combine unrelated movements or use more than two codes. Match using objective activity type, speed, grade, terrain, and effort, and copy exact supplied codes and MET values.

Then consider only contextual details not represented by that base row, such as a light backpack, unusual resistance, surface, or environmental conditions. Express their combined effect as one adjustment_percent applied to the base row's NET active energy. Use 0 when the base row already represents the context or there is no well-supported adjustment. Explain it briefly in adjustment_rationale. Do not choose a different activity category merely because an accessory is mentioned: ordinary level walking with a backpack remains walking, not hiking/backpacking.

For a light carried load during level walking, use this conservative default: adjustment_percent = load_kg / ${p.weightKg} × 100. Thus, 5 kg on this ${p.weightKg} kg person adds about ${Math.round(500/p.weightKg)}% to net walking energy. Do not apply the load twice if the selected base row already includes a comparable load.

Determine a realistic duration of at least 1 minute. Use an explicitly stated duration when present. Otherwise derive duration from supplied distance or step count and pace. For steps, estimate distance using stride length ${Math.round(p.heightCm*(p.sex==="male"?.415:.413))/100} metres per step. If the description gives a range, use its midpoint and say so. Never use a tiny placeholder duration.

The final adjusted MET is: adjusted_MET = 1 + (base_met - 1) × (1 + adjustment_percent / 100). Calculate net active energy with: active_energy_kcal = (adjusted_MET - 1) × 3.5 × ${p.weightKg} kg ÷ 200 × duration_minutes. Do not include resting energy. Personal context: biological sex ${p.sex}, age ${p.age} years, height ${p.heightCm} cm, weight ${p.weightKg} kg. Use heart rate and age only as secondary evidence when selecting effort. When the description supplies any HR for an activity, treat it as that activity's average_heart_rate_bpm even when the user does not explicitly say "average." If an HR range is supplied, use its midpoint. Return null only when no HR is supplied for that activity; never invent one.

Activity description: ${text}

Official Compendium candidates (code | MET | description):
${candidates.map(x=>`${x.code} | ${x.met} | ${x.description}`).join("\n")}

Return base_reference_codes, base_met (the exact row MET for one code or arithmetic mean for two), adjustment_percent, adjustment_rationale, average_heart_rate_bpm, duration_minutes, human-readable duration, and the equation result for every activity. Return JSON only.`;

function hrActiveEnergy(profile:Profile,bpm:number,durationMinutes:number){
  const grossPerMinute=(profile.sex==="male"
    ? -55.0969+0.6309*bpm+0.1988*profile.weightKg+0.2017*profile.age
    : -20.4022+0.4472*bpm-0.1263*profile.weightKg+0.074*profile.age)/4.184;
  const restingPerMinute=(10*profile.weightKg+6.25*profile.heightCm-5*profile.age+(profile.sex==="male"?5:-161))/1440;
  return Math.max(0,(grossPerMinute-restingPerMinute)*durationMinutes);
}

export async function POST(r:Request){
  try{
    const form=await r.formData();const date=dateSchema.parse(form.get("date"));const source=String(form.get("text")??"").trim();const files=form.getAll("images");
    if(!source&&!files.length)throw new Error("Add an activity description or image");
    const images:ImageInput[]=[];for(const item of files){if(!(item instanceof File)||!allowedImages.has(item.type))throw new Error("Unsupported image type");if(item.size>maxImageSize)throw new Error("Each image must be 10 MB or smaller");images.push({mime:item.type,base64:Buffer.from(await item.arrayBuffer()).toString("base64")})}
    const profile=(await readState()).profile;if(!profile)throw new Error("Save your profile before analyzing activity");
    const candidates=metCandidates(source||"walking running cycling swimming exercise sports yoga weight training");if(!candidates.length)throw new Error("No matching activities were found in the MET reference table");
    const content=[{type:"text",text:prompt(source||"No text description; identify the activity from the attached image.",profile,candidates)},...images.map(image=>({type:"image_url",image_url:{url:`data:${image.mime};base64,${image.base64}`}}))];
    const parsed=activityResult.parse(await askOpenRouter(content,activityJsonSchema,"activity_analysis"));
    const byCode=new Map(candidates.map(x=>[x.code,x]));const now=new Date().toISOString();
    const entries=parsed.activities.map(x=>{
      if(new Set(x.base_reference_codes).size!==x.base_reference_codes.length)throw new Error("AI returned duplicate Compendium activity codes");
      const bases=x.base_reference_codes.map(code=>{const row=byCode.get(code);if(!row)throw new Error(`AI selected an unavailable Compendium activity code: ${code}`);return row});
      const baseMet=bases.reduce((sum,row)=>sum+row.met,0)/bases.length;
      if(Math.abs(x.base_met-baseMet)>.001)throw new Error(`AI returned the wrong average base MET for Compendium codes ${x.base_reference_codes.join(", ")}`);
      const adjustedMet=1+(baseMet-1)*(1+x.adjustment_percent/100);
      const metEnergy=(adjustedMet-1)*3.5*profile.weightKg/200*x.duration_minutes;
      const useHr=x.average_heart_rate_bpm!=null&&x.average_heart_rate_bpm>=100;
      const rawHrEnergy=useHr?hrActiveEnergy(profile,x.average_heart_rate_bpm!,x.duration_minutes):null;
      const boundedHrEnergy=rawHrEnergy==null?null:Math.min(metEnergy*2,Math.max(metEnergy*.5,rawHrEnergy));
      const activeEnergy=boundedHrEnergy==null?metEnergy:metEnergy*.65+boundedHrEnergy*.35;
      const hrNote=boundedHrEnergy==null?"":` HR cross-check: ${x.average_heart_rate_bpm} bpm; 65% MET + 35% bounded HR estimate.`;
      return{id:crypto.randomUUID(),name:x.name,duration:x.duration,durationMinutes:x.duration_minutes,met:adjustedMet,baseMet,adjustmentPercent:x.adjustment_percent,averageHeartRateBpm:x.average_heart_rate_bpm??undefined,compendiumCode:bases.map(row=>row.code).join(", "),metRationale:x.adjustment_rationale+hrNote,activeEnergy,sourceText:source,createdAt:now};
    });
    await updateState(s=>{const d=s.days[date]??blankDay();d.activities.push(...entries);s.days[date]=d});
    return NextResponse.json({entries});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Analysis failed"},{status:400})}
}

export async function DELETE(r:Request){try{const {date,id}=await r.json();dateSchema.parse(date);if(typeof id!=="string")throw new Error("Invalid id");return NextResponse.json(await updateState(s=>{const d=s.days[date];if(d)d.activities=d.activities.filter(x=>x.id!==id)}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
