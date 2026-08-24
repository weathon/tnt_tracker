import {z} from "zod";
import type {State} from "./types";

export const BACKUP_APP="fuel-and-motion";
export const BACKUP_VERSION=1 as const;

const id=z.string().min(1);
const dateKey=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Expected a date in YYYY-MM-DD format");
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,"Expected a time in HH:MM format");
const createdAt=z.string().min(1);

const profile=z.object({
 sex:z.string(),
 age:z.number().finite(),
 heightCm:z.number().finite(),
 // Kept for round-trip compatibility with backups made before weight logs replaced it.
 weightKg:z.number().finite().optional(),
}).strict();

const food=z.object({
 id,
 name:z.string(),
 amount:z.string(),
 energy:z.number().finite(),
 time:time.optional(),
 sourceText:z.string().optional(),
 createdAt,
}).strict();

const activity=z.object({
 id,
 name:z.string(),
 duration:z.string(),
 time:time.optional(),
 durationMinutes:z.number().finite().optional(),
 met:z.number().finite().optional(),
 baseMet:z.number().finite().optional(),
 adjustmentPercent:z.number().finite().optional(),
 averageHeartRateBpm:z.number().finite().optional(),
 compendiumCode:z.string().optional(),
 metRationale:z.string().optional(),
 activeEnergy:z.number().finite(),
 sourceText:z.string(),
 createdAt,
}).strict();

const medicationDefinition=z.object({id,name:z.string(),dose:z.string(),createdAt}).strict();
const medication=z.object({id,medicationId:z.string().optional(),name:z.string(),dose:z.string(),time,createdAt}).strict();
const weight=z.object({id,weightKg:z.number().finite(),time,createdAt}).strict();
const day=z.object({
 foods:z.array(food),
 activities:z.array(activity),
 medications:z.array(medication).default([]),
 weights:z.array(weight).default([]),
 trackerBurn:z.number().finite().nullable(),
 correctionFactor:z.number().finite(),
 rulerPosition:z.number().finite(),
}).strict();

export const backupStateSchema=z.object({
 profile:profile.nullable(),
 days:z.record(dateKey,day),
 medicationList:z.array(medicationDefinition),
 forgottenMedicationIds:z.array(z.string()).optional(),
}).strict();

export const backupSchema=z.object({
 app:z.literal(BACKUP_APP),
 version:z.literal(BACKUP_VERSION),
 exportedAt:z.string().min(1),
 data:backupStateSchema,
}).strict();

export type Backup=z.infer<typeof backupSchema>;

export function createBackup(state:State,exportedAt=new Date().toISOString()):Backup{
 return backupSchema.parse({app:BACKUP_APP,version:BACKUP_VERSION,exportedAt,data:state});
}

export function parseBackup(value:unknown):State{
 return backupSchema.parse(value).data;
}
