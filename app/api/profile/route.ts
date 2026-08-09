import { NextResponse } from "next/server"; import { updateState } from "@/lib/store"; import { profileSchema } from "@/lib/validation";
export async function PUT(r:Request){try{const p=profileSchema.parse(await r.json());return NextResponse.json(await updateState(s=>{s.profile=p}))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid request"},{status:400})}}
