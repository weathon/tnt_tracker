import {get,put} from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Day, MedicationDefinition, State } from "./types";
const file = path.join(process.cwd(), "data", "tracker.json");
const blobPath="fuel-and-motion/tracker.json";
const initial: State = { profile:null, days:{}, medicationList:[] };
let queue = Promise.resolve();
export const blankDay = (): Day => ({foods:[],activities:[],medications:[],weights:[],trackerBurn:null,correctionFactor:1,rulerPosition:.5});
const medicationKey=(name:string,dose:string)=>`${name.trim().toLocaleLowerCase()}\u0000${dose.trim().toLocaleLowerCase()}`;
const stableMedicationId=(key:string)=>{let hash=2166136261;for(const character of key){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}return `history-${(hash>>>0).toString(36)}`};
export const medicationHistoryId=(name:string,dose:string)=>stableMedicationId(medicationKey(name,dose));
export function normalizeState(value:Partial<State>):State { const days=value.days??{};const saved=value.medicationList??[];const forgottenMedicationIds=value.forgottenMedicationIds??[];const forgotten=new Set(forgottenMedicationIds);const seen=new Set(saved.map(medication=>medicationKey(medication.name,medication.dose)));const history:MedicationDefinition[]=[];for(const day of Object.values(days)){for(const medication of day.medications??[]){const key=medicationKey(medication.name,medication.dose);const id=medicationHistoryId(medication.name,medication.dose);if(seen.has(key)||forgotten.has(id))continue;seen.add(key);history.push({id,name:medication.name,dose:medication.dose,createdAt:medication.createdAt})}}return {profile:value.profile??null,days,medicationList:[...saved,...history],forgottenMedicationIds}; }
const hasBlobStorage=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.VERCEL_OIDC_TOKEN&&process.env.BLOB_STORE_ID));
async function readStoredState():Promise<State>{
 if(hasBlobStorage()){
  const result=await get(blobPath,{access:"private",useCache:false});
  if(!result)return structuredClone(initial);
  if(result.statusCode!==200||!result.stream)throw new Error("Could not read the latest tracker data from Vercel Blob");
  return normalizeState(await new Response(result.stream).json());
 }
 if(process.env.VERCEL)throw new Error("Persistent storage is not configured. Attach a private Vercel Blob store to this project and redeploy.");
 try{return normalizeState(JSON.parse(await fs.readFile(file,"utf8")))}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return structuredClone(initial);throw error}
}
export async function readState():Promise<State>{return readStoredState()}
async function persistState(state:State){
 if(hasBlobStorage()){
  await put(blobPath,JSON.stringify(state,null,2),{access:"private",allowOverwrite:true,contentType:"application/json",cacheControlMaxAge:60});
  return;
 }
 if(process.env.VERCEL)throw new Error("Persistent storage is not configured. Attach a private Vercel Blob store to this project and redeploy.");
 await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+".tmp";await fs.writeFile(tmp,JSON.stringify(state,null,2));await fs.rename(tmp,file);
}
function enqueue(job:()=>Promise<State>):Promise<State>{const result=queue.then(job);queue=result.then(()=>undefined,()=>undefined);return result}
export function updateState(fn:(s:State)=>void):Promise<State>{return enqueue(async()=>{const state=await readStoredState();fn(state);await persistState(state);return state})}
export function replaceState(state:State):Promise<State>{return enqueue(async()=>{const replacement=structuredClone(state);await persistState(replacement);return replacement})}
