import { NextResponse } from "next/server";
import { blankDay, updateState } from "@/lib/store";
import { dateSchema, medicationSchema } from "@/lib/validation";

export async function POST(r:Request){try{const value=medicationSchema.parse(await r.json());const entry={id:crypto.randomUUID(),name:value.name,dose:value.dose,time:value.time,createdAt:new Date().toISOString()};await updateState(s=>{const d=s.days[value.date]??blankDay();(d.medications??=[]).push(entry);s.days[value.date]=d});return NextResponse.json({entry});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid medication"},{status:400})}}
export async function DELETE(r:Request){try{const {date,id}=await r.json();dateSchema.parse(date);if(typeof id!=="string")throw new Error("Invalid id");return NextResponse.json(await updateState(s=>{const d=s.days[date];if(d)d.medications=(d.medications??[]).filter(x=>x.id!==id)}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
