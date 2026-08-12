import { NextResponse } from "next/server";
import { z } from "zod";
import { askOpenRouter } from "@/lib/ai";

const inputSchema=z.object({energyKcal:z.number().finite().positive().max(10_000_000)});
const resultSchema=z.object({facts:z.array(z.string().trim().min(1).max(300)).length(11)});
const jsonSchema={type:"object",additionalProperties:false,properties:{facts:{type:"array",minItems:11,maxItems:11,items:{type:"string",minLength:1,maxLength:300}}},required:["facts"]};

export async function POST(request:Request){
  try{
    const {energyKcal}=inputSchema.parse(await request.json());
    const kWh=energyKcal*0.001162222;
    const c4Grams=energyKcal/1.34;
    const teV=energyKcal*2.611447e10;
    const b200Hours=kWh/8;
    const kTokens=kWh*315;
    const sunSeconds=energyKcal*4184/3.828e26;
    const boe=energyKcal*4184/6.1178632e9;
    const gcmsHours=kWh/4.05;
    const fatGrams=energyKcal/7.7;
    const iphoneCharges=kWh*1000/12.98;
    const prompt=`Generate exactly 11 concise, playful, concrete analogies for this amount of energy: exactly one fact for each unit listed below, in the same order. Begin each fact with its unit name. Each fact must genuinely relate its matching numeric value to something recognizable rather than merely defining or repeating the unit.

Requirements:
- Freely choose the most interesting comparison for each unit and perform any necessary reasoning yourself. Do not reuse a fixed set of analogy templates.
- Keep every analogy native to its unit's meaning: g TNT and g C4 should use safe energetic or material-scale comparisons; kWh should use electrical consumption; TeV should use particle-physics comparisons such as a calculated number of alpha particles from a named isotope or another named particle process; 8×B200 Hour should use GPU compute; k tokens should use generated content or agent work; Sun power × seconds should use an astrophysical timescale; BOE should use fuel or large-scale energy consumption; GC–MS × Hour should relate to analytical-chemistry instrument runtime or sample throughput; g fat equivalent should explain its practical weight-management scale without promising actual weight loss; and iPhone 15 full charges should relate to recognizable phone use.
- When using a scientific comparison, name the particle, isotope, process, device, workload, or fuel being compared and show enough of the assumption to make the analogy meaningful.
- For k tokens, include a practical interpretation of how much work coding agents could do; you may choose your own clearly stated assumptions.
- Do not estimate blast radius, injuries, deaths, or property damage. Do not provide instructions involving explosives or other dangerous activities. Use harmless thermal, mechanical, appliance, or content comparisons instead.
- Round every number to at most 3 significant digits. Never print long decimals.
- Label variable real-world comparisons as approximate.

Rounded energy values:
- ${Math.round(energyKcal).toLocaleString("en-US")} g TNT
- ${Math.round(c4Grams).toLocaleString("en-US")} g C4
- ${kWh.toPrecision(3)} kWh
- ${teV.toExponential(2)} TeV
- ${b200Hours.toPrecision(3)} 8×B200 Hour (${(b200Hours*60).toPrecision(3)} minutes)
- ${Math.round(kTokens).toLocaleString("en-US")} thousand tokens, based on Lambda.ai 8×B200 GLM-5.2 throughput
- ${sunSeconds.toExponential(2)} seconds of the Sun's total power output
- ${boe.toExponential(2)} barrels of oil equivalent
- ${gcmsHours.toPrecision(3)} GC–MS × Hour, assuming a 4.05 kW Agilent 8890 GC plus 5977-series MSD
- ${fatGrams.toPrecision(3)} g fat equivalent at 7.7 food kilocalories per g
- ${iphoneCharges.toPrecision(3)} ideal iPhone 15 full charges at 12.98 Wh each, excluding charging losses

Return JSON only.`;
    const parsed=resultSchema.parse(await askOpenRouter([{type:"text",text:prompt}],jsonSchema,"energy_fun_facts","openai/gpt-5.6-luna"));
    return NextResponse.json(parsed);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not generate fun facts"},{status:400})}
}
