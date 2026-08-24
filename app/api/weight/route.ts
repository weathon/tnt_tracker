import {NextResponse} from "next/server";
import {blankDay,updateState} from "@/lib/store";
import {dateSchema,weightSchema} from "@/lib/validation";

export async function POST(request:Request){try{const value=weightSchema.parse(await request.json());const entry={id:crypto.randomUUID(),weightKg:value.weightKg,time:value.time,createdAt:new Date().toISOString()};await updateState(state=>{const day=state.days[value.date]??blankDay();(day.weights??=[]).push(entry);state.days[value.date]=day});return NextResponse.json({entry});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}}
export async function DELETE(request:Request){try{const {date,id}=await request.json();dateSchema.parse(date);return NextResponse.json(await updateState(state=>{const day=state.days[date];if(day)day.weights=(day.weights??[]).filter(entry=>entry.id!==id)}))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}}
