import { promises as fs } from "node:fs";
import path from "node:path";
import type { Day, MedicationDefinition, State } from "./types";
const file = path.join(process.cwd(), "data", "tracker.json");
const initial: State = { profile:null, days:{}, medicationList:[] };
let queue = Promise.resolve();
export const blankDay = (): Day => ({foods:[],activities:[],medications:[],weights:[],trackerBurn:null,correctionFactor:1,rulerPosition:.5});
const medicationKey=(name:string,dose:string)=>`${name.trim().toLocaleLowerCase()}\u0000${dose.trim().toLocaleLowerCase()}`;
const stableMedicationId=(key:string)=>{let hash=2166136261;for(const character of key){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}return `history-${(hash>>>0).toString(36)}`};
export const medicationHistoryId=(name:string,dose:string)=>stableMedicationId(medicationKey(name,dose));
export function normalizeState(value:Partial<State>):State { const days=value.days??{};const saved=value.medicationList??[];const forgottenMedicationIds=value.forgottenMedicationIds??[];const forgotten=new Set(forgottenMedicationIds);const seen=new Set(saved.map(medication=>medicationKey(medication.name,medication.dose)));const history:MedicationDefinition[]=[];for(const day of Object.values(days)){for(const medication of day.medications??[]){const key=medicationKey(medication.name,medication.dose);const id=medicationHistoryId(medication.name,medication.dose);if(seen.has(key)||forgotten.has(id))continue;seen.add(key);history.push({id,name:medication.name,dose:medication.dose,createdAt:medication.createdAt})}}return {profile:value.profile??null,days,medicationList:[...saved,...history],forgottenMedicationIds}; }
export async function readState(): Promise<State> { try { return normalizeState(JSON.parse(await fs.readFile(file,"utf8"))); } catch(e) { if ((e as NodeJS.ErrnoException).code==="ENOENT") return structuredClone(initial); throw e; } }
export function updateState(fn:(s:State)=>void): Promise<State> { const job=queue.then(async()=>{ const s=await readState(); fn(s); await fs.mkdir(path.dirname(file),{recursive:true}); const tmp=file+".tmp"; await fs.writeFile(tmp,JSON.stringify(s,null,2)); await fs.rename(tmp,file); return s; }); queue=job.then(()=>undefined,()=>undefined); return job; }
