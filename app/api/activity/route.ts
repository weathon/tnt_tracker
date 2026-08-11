import { NextResponse } from "next/server";
import { activityJsonSchema,activityResult,askOpenRouter } from "@/lib/ai";
import { blankDay,readState,updateState } from "@/lib/store";
import { dateSchema } from "@/lib/validation";
import type { Profile } from "@/lib/types";
import { metCandidates, type MetRow } from "@/lib/met";

const prompt=(text:string,p:Profile,candidates:MetRow[])=>`Split this description into distinct physical activities. For each one, first choose exactly one best base activity from the supplied official 2024 Adult Compendium rows. Match the core movement using objective activity type, speed, grade, terrain, and effort. Copy its exact base_reference_code and base_met. Do not combine, average, or cite multiple codes.

Then consider only contextual details not represented by that base row, such as a light backpack, unusual resistance, surface, or environmental conditions. Express their combined effect as one adjustment_percent applied to the base row's NET active energy. Use 0 when the base row already represents the context or there is no well-supported adjustment. Explain it briefly in adjustment_rationale. Do not choose a different activity category merely because an accessory is mentioned: ordinary level walking with a backpack remains walking, not hiking/backpacking.

For a light carried load during level walking, use this conservative default: adjustment_percent = load_kg / ${p.weightKg} × 100. Thus, 5 kg on this ${p.weightKg} kg person adds about ${Math.round(500/p.weightKg)}% to net walking energy. Do not apply the load twice if the selected base row already includes a comparable load.

Determine a realistic duration of at least 1 minute. Use an explicitly stated duration when present. Otherwise derive duration from supplied distance or step count and pace. For steps, estimate distance using stride length ${Math.round(p.heightCm*(p.sex==="male"?.415:.413))/100} metres per step. If the description gives a range, use its midpoint and say so. Never use a tiny placeholder duration.

The final adjusted MET is: adjusted_MET = 1 + (base_met - 1) × (1 + adjustment_percent / 100). Calculate net active energy with: active_energy_kcal = (adjusted_MET - 1) × 3.5 × ${p.weightKg} kg ÷ 200 × duration_minutes. Do not include resting energy. Personal context: biological sex ${p.sex}, age ${p.age} years, height ${p.heightCm} cm, weight ${p.weightKg} kg. Use heart rate and age only as secondary evidence when selecting effort. When the description supplies any HR for an activity, treat it as that activity's average_heart_rate_bpm even when the user does not explicitly say "average." If an HR range is supplied, use its midpoint. Return null only when no HR is supplied for that activity; never invent one.

Activity description: ${text}

Official Compendium candidates (code | MET | description):
${candidates.map(x=>`${x.code} | ${x.met} | ${x.description}`).join("\n")}

Return base_reference_code, exact base_met, adjustment_percent, adjustment_rationale, average_heart_rate_bpm, duration_minutes, human-readable duration, and the equation result for every activity. Return JSON only.`;

function hrActiveEnergy(profile:Profile,bpm:number,durationMinutes:number){
  const grossPerMinute=(profile.sex==="male"
    ? -55.0969+0.6309*bpm+0.1988*profile.weightKg+0.2017*profile.age
    : -20.4022+0.4472*bpm-0.1263*profile.weightKg+0.074*profile.age)/4.184;
  const restingPerMinute=(10*profile.weightKg+6.25*profile.heightCm-5*profile.age+(profile.sex==="male"?5:-161))/1440;
  return Math.max(0,(grossPerMinute-restingPerMinute)*durationMinutes);
}

export async function POST(r:Request){
  try{
    const body=await r.json();const date=dateSchema.parse(body.date);const source=String(body.text??"").trim();
    if(!source)throw new Error("Add an activity description");
    const profile=(await readState()).profile;if(!profile)throw new Error("Save your profile before analyzing activity");
    const candidates=metCandidates(source);if(!candidates.length)throw new Error("No matching activities were found in the MET reference table");
    const parsed=activityResult.parse(await askOpenRouter([{type:"text",text:prompt(source,profile,candidates)}],activityJsonSchema,"activity_analysis"));
    const byCode=new Map(candidates.map(x=>[x.code,x]));const now=new Date().toISOString();
    const entries=parsed.activities.map(x=>{
      const base=byCode.get(x.base_reference_code);if(!base)throw new Error(`AI selected an unavailable Compendium activity code: ${x.base_reference_code}`);
      if(x.base_met!==base.met)throw new Error(`AI returned the wrong base MET for Compendium code ${x.base_reference_code}`);
      const adjustedMet=1+(base.met-1)*(1+x.adjustment_percent/100);
      const metEnergy=(adjustedMet-1)*3.5*profile.weightKg/200*x.duration_minutes;
      const useHr=x.average_heart_rate_bpm!=null&&x.average_heart_rate_bpm>=100;
      const rawHrEnergy=useHr?hrActiveEnergy(profile,x.average_heart_rate_bpm!,x.duration_minutes):null;
      const boundedHrEnergy=rawHrEnergy==null?null:Math.min(metEnergy*2,Math.max(metEnergy*.5,rawHrEnergy));
      const activeEnergy=boundedHrEnergy==null?metEnergy:metEnergy*.65+boundedHrEnergy*.35;
      const hrNote=boundedHrEnergy==null?"":` HR cross-check: ${x.average_heart_rate_bpm} bpm; 65% MET + 35% bounded HR estimate.`;
      return{id:crypto.randomUUID(),name:x.name,duration:x.duration,durationMinutes:x.duration_minutes,met:adjustedMet,baseMet:base.met,adjustmentPercent:x.adjustment_percent,compendiumCode:base.code,metRationale:x.adjustment_rationale+hrNote,activeEnergy,sourceText:source,createdAt:now};
    });
    await updateState(s=>{const d=s.days[date]??blankDay();d.activities.push(...entries);s.days[date]=d});
    return NextResponse.json({entries});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Analysis failed"},{status:400})}
}

export async function DELETE(r:Request){try{const {date,id}=await r.json();dateSchema.parse(date);if(typeof id!=="string")throw new Error("Invalid id");return NextResponse.json(await updateState(s=>{const d=s.days[date];if(d)d.activities=d.activities.filter(x=>x.id!==id)}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
