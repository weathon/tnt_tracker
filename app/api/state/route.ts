import {stateResponse} from "@/lib/food-response";
import { NextResponse } from "next/server"; import { readState } from "@/lib/store";
export const dynamic="force-dynamic";
export async function GET(){try{return stateResponse(await readState())}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not read tracker data"},{status:500})}}
