import { NextResponse } from "next/server";
import { medicationHistoryId, updateState } from "@/lib/store";
import { medicationDefinitionSchema } from "@/lib/validation";

export async function POST(request:Request){
 try{
  const value=medicationDefinitionSchema.parse(await request.json());
  let medicationId="";
  await updateState(state=>{
   const existing=state.medicationList.find(medication=>medication.name.toLocaleLowerCase()===value.name.toLocaleLowerCase()&&medication.dose.toLocaleLowerCase()===value.dose.toLocaleLowerCase());
   if(existing){medicationId=existing.id;return}
   const medication={id:crypto.randomUUID(),name:value.name,dose:value.dose,createdAt:new Date().toISOString()};
   medicationId=medication.id;
   state.medicationList.push(medication);
  });
  return NextResponse.json({id:medicationId});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid medication"},{status:400})}
}

export async function DELETE(request:Request){
 try{
  const {id}=await request.json();
  if(typeof id!=="string")throw new Error("Invalid medication id");
  await updateState(state=>{const removed=state.medicationList.find(medication=>medication.id===id);state.medicationList=state.medicationList.filter(medication=>medication.id!==id);if(removed){const historyId=medicationHistoryId(removed.name,removed.dose);if(!(state.forgottenMedicationIds??=[]).includes(historyId))state.forgottenMedicationIds.push(historyId)}});
  return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid request"},{status:400})}
}
