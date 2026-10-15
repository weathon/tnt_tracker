import {BlobNotFoundError,BlobPreconditionFailedError,get,head,put} from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Day, State } from "./types";
const file = path.join(process.cwd(), "data", "tracker.json");
const blobPath="fuel-and-motion/tracker.json";
const initial: State = { days:{} };
let queue = Promise.resolve();
export const blankDay = (): Day => ({foods:[],trackerBurn:null});
export function normalizeState(value:Partial<State>):State {
 const days=Object.fromEntries(Object.entries(value.days??{}).map(([date,day])=>[date,{...day,foods:day.foods??[],trackerBurn:day.trackerBurn??null}]));
 return {...value,days};
}
const hasBlobStorage=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.VERCEL_OIDC_TOKEN&&process.env.BLOB_STORE_ID));
type StoredState={state:State;etag?:string};
async function readStoredState(forUpdate=false):Promise<StoredState>{
 if(hasBlobStorage()){
  let etag:string|undefined;
  if(forUpdate){
   // Download ETags can be weak or transformed by delivery. Use the storage
   // API's version for writes, captured BEFORE reading the uncached content.
   // A write between these reads then fails ifMatch and safely retries.
   try{etag=(await head(blobPath)).etag}
   catch(error){if(error instanceof BlobNotFoundError)return {state:structuredClone(initial)};throw error}
   if(!etag)throw new Error("Tracker storage returned no version for a safe update");
  }
  const result=await get(blobPath,{access:"private",useCache:false});
  if(!result)return {state:structuredClone(initial)};
  if(result.statusCode!==200||!result.stream)throw new Error("Could not read the latest tracker data from Vercel Blob");
  return {state:normalizeState(await new Response(result.stream).json()),etag};
 }
 if(process.env.VERCEL)throw new Error("Persistent storage is not configured. Attach a private Vercel Blob store to this project and redeploy.");
 try{return {state:normalizeState(JSON.parse(await fs.readFile(file,"utf8")))}}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return {state:structuredClone(initial)};throw error}
}
export async function readState():Promise<State>{return (await readStoredState()).state}
async function persistState(state:State,snapshot?:StoredState){
 if(hasBlobStorage()){
  await put(blobPath,JSON.stringify(state,null,2),{access:"private",allowOverwrite:snapshot===undefined||!!snapshot.etag,ifMatch:snapshot?.etag,contentType:"application/json",cacheControlMaxAge:60});
  return;
 }
 if(process.env.VERCEL)throw new Error("Persistent storage is not configured. Attach a private Vercel Blob store to this project and redeploy.");
 await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+".tmp";await fs.writeFile(tmp,JSON.stringify(state,null,2));await fs.rename(tmp,file);
}
function enqueue(job:()=>Promise<State>):Promise<State>{const result=queue.then(job);queue=result.then(()=>undefined,()=>undefined);return result}
// The queue only covers this process. Blob versions protect against writes from
// other server instances. Save the mutation ID atomically with its changes so
// a lost write acknowledgement cannot cause a committed mutation to run twice.
export function updateState(fn:(s:State)=>void,mutationId:string=crypto.randomUUID()):Promise<State>{return enqueue(async()=>{
 for(let attempt=0;attempt<5;attempt++){
  const snapshot=await readStoredState(true);
  if(snapshot.state.appliedMutationIds?.includes(mutationId))return snapshot.state;
  fn(snapshot.state);
  (snapshot.state.appliedMutationIds??=[]).push(mutationId);
  try{await persistState(snapshot.state,snapshot);return snapshot.state}
  catch(error){if(!(error instanceof BlobPreconditionFailedError))throw error}
 }
 throw new Error("Tracker data changed while saving. Please try again.");
})}
export function replaceState(state:State):Promise<State>{return enqueue(async()=>{const replacement=structuredClone(state);await persistState(replacement);return replacement})}
