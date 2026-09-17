import {stateResponse} from "@/lib/food-response";
import {NextResponse} from "next/server";
import {blankDay,updateState} from "@/lib/store";
import {bloodPressureSchema,dateSchema} from "@/lib/validation";

export async function POST(request:Request){try{const value=bloodPressureSchema.parse(await request.json());const entry={id:crypto.randomUUID(),systolic:value.systolic,diastolic:value.diastolic,time:value.time,note:value.note||undefined,createdAt:new Date().toISOString()};await updateState(state=>{const day=state.days[value.date]??blankDay();(day.bloodPressures??=[]).push(entry);state.days[value.date]=day});return NextResponse.json({entry});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}}
export async function DELETE(request:Request){try{const {date,id}=await request.json();dateSchema.parse(date);if(typeof id!=="string")throw new Error("Invalid id");return stateResponse(await updateState(state=>{const day=state.days[date];if(day)day.bloodPressures=(day.bloodPressures??[]).filter(entry=>entry.id!==id)}))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}}
