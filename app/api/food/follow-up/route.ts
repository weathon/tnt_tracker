import {foodForClient} from "@/lib/food-response";
import {NextResponse} from "next/server";
import {z} from "zod";
import {followUpFood} from "@/lib/food-ai";
import {applyFoodFollowUp,findFood,FoodConversationError,foodConversationVersion} from "@/lib/food-conversation";
import {readFoodImages} from "@/lib/food-images";
import {readState,updateState} from "@/lib/store";
import type {State} from "@/lib/types";

const requestSchema=z.object({id:z.string().min(1),submissionId:z.uuid(),message:z.string().trim().max(4000,"Keep your question under 4,000 characters.")});

// The page sends a form so follow-ups can carry photos; JSON stays accepted
// for text-only callers.
async function readFollowUp(request:Request){
 if(!request.headers.get("content-type")?.startsWith("multipart/form-data"))return {...requestSchema.parse(await request.json()),files:[] as FormDataEntryValue[]};
 const form=await request.formData();
 return {...requestSchema.parse({id:form.get("id"),submissionId:form.get("submissionId"),message:form.get("message")??""}),files:form.getAll("images")};
}

function savedResponse(state:State,id:string,submissionId:string){
 const {entry}=findFood(state,id);
 const reply=entry.conversation?.find(message=>message.id===`${submissionId}:assistant`);
 if(!reply)throw new FoodConversationError("This follow-up was already processed. Refresh the entry before continuing.",409);
 return NextResponse.json({entry:foodForClient(entry),reply});
}

export async function POST(request:Request){
 try{
  const {id,submissionId,message,files}=await readFollowUp(request);
  if(!message&&!files.length)throw new Error("Ask a question or add a photo first.");
  const mutationId=`food-follow-up:${id}:${submissionId}`;
  const saved=await readState();
  if(saved.appliedMutationIds?.includes(mutationId))return savedResponse(saved,id,submissionId);
  const {entry}=findFood(saved,id);
  const images=await readFoodImages(files);
  const version=foodConversationVersion(entry);
  const {result,raw}=await followUpFood(entry,message,images);
  const state=await updateState(current=>{
   applyFoodFollowUp(current,id,version,submissionId,message,result,raw,images);
  },mutationId);
  return savedResponse(state,id,submissionId);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Could not answer this question"},{status:error instanceof FoodConversationError?error.status:400});
 }
}
