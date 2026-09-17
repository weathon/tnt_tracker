import {foodForClient} from "@/lib/food-response";
import {NextResponse} from "next/server";
import {z} from "zod";
import {followUpFood} from "@/lib/food-ai";
import {applyFoodFollowUp,findFood,FoodConversationError,foodConversationVersion} from "@/lib/food-conversation";
import {readState,updateState} from "@/lib/store";
import type {State} from "@/lib/types";

const requestSchema=z.object({id:z.string().min(1),submissionId:z.uuid(),message:z.string().trim().min(1,"Ask a question first.").max(4000,"Keep your question under 4,000 characters.")});

function savedResponse(state:State,id:string,submissionId:string){
 const {entry}=findFood(state,id);
 const reply=entry.conversation?.find(message=>message.id===`${submissionId}:assistant`);
 if(!reply)throw new FoodConversationError("This follow-up was already processed. Refresh the entry before continuing.",409);
 return NextResponse.json({entry:foodForClient(entry),reply});
}

export async function POST(request:Request){
 try{
  const {id,submissionId,message}=requestSchema.parse(await request.json());
  const mutationId=`food-follow-up:${id}:${submissionId}`;
  const saved=await readState();
  if(saved.appliedMutationIds?.includes(mutationId))return savedResponse(saved,id,submissionId);
  const {entry}=findFood(saved,id);
  const version=foodConversationVersion(entry);
  const {result,raw}=await followUpFood(entry,message);
  const state=await updateState(current=>{
   applyFoodFollowUp(current,id,version,submissionId,message,result,raw);
  },mutationId);
  return savedResponse(state,id,submissionId);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Could not answer this question"},{status:error instanceof FoodConversationError?error.status:400});
 }
}
