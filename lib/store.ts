import { promises as fs } from "node:fs";
import path from "node:path";
import type { Day, State } from "./types";
const file = path.join(process.cwd(), "data", "tracker.json");
const initial: State = { profile:null, days:{} };
let queue = Promise.resolve();
export const blankDay = (): Day => ({foods:[],activities:[],trackerBurn:null,correctionFactor:1,rulerPosition:.5});
export async function readState(): Promise<State> { try { return JSON.parse(await fs.readFile(file,"utf8")); } catch(e) { if ((e as NodeJS.ErrnoException).code==="ENOENT") return structuredClone(initial); throw e; } }
export function updateState(fn:(s:State)=>void): Promise<State> { const job=queue.then(async()=>{ const s=await readState(); fn(s); await fs.mkdir(path.dirname(file),{recursive:true}); const tmp=file+".tmp"; await fs.writeFile(tmp,JSON.stringify(s,null,2)); await fs.rename(tmp,file); return s; }); queue=job.then(()=>undefined,()=>undefined); return job; }
