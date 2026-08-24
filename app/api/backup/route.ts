import {NextResponse} from "next/server";
import {createBackup,parseBackup} from "@/lib/backup";
import {readState,replaceState} from "@/lib/store";

export const dynamic="force-dynamic";

export async function GET(){
 try{
  const backup=createBackup(await readState());
  const date=backup.exportedAt.slice(0,10);
  return new Response(JSON.stringify(backup,null,2),{headers:{
   "Content-Type":"application/json; charset=utf-8",
   "Content-Disposition":`attachment; filename="fuel-and-motion-${date}.json"`,
   "Cache-Control":"no-store",
  }});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not export data"},{status:500})}
}

export async function PUT(request:Request){
 try{
  const state=parseBackup(await request.json());
  await replaceState(state);
  return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof Error?`Invalid backup: ${error.message}`:"Invalid backup file"},{status:400})}
}
