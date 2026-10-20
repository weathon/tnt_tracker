import {z} from "zod";
import type {State} from "./types";
import {foodImagesSchema} from "./food-images";

export const BACKUP_APP="fuel-and-motion";
export const BACKUP_VERSION=1 as const;

const id=z.string().min(1);
const dateKey=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Expected a date in YYYY-MM-DD format");
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,"Expected a time in HH:MM format");
const createdAt=z.string().min(1);

const food=z.object({
 id,
 name:z.string(),
 amount:z.string(),
 energy:z.number().finite(),
 price:z.number().finite().nonnegative().optional(),
 items:z.array(z.object({name:z.string(),grams:z.number().finite().nonnegative(),kcalPer100g:z.number().finite().nonnegative(),energy:z.number().finite().nonnegative(),price:z.number().finite().nonnegative().optional(),proteinG:z.number().finite().nonnegative().optional(),carbsG:z.number().finite().nonnegative().optional(),fatG:z.number().finite().nonnegative().optional(),sodiumMg:z.number().finite().nonnegative().optional(),confidence:z.enum(["high","medium","low"])}).strict()).optional(),
 energyRange:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative()]).optional(),
 macros:z.object({proteinG:z.number().finite().nonnegative(),carbsG:z.number().finite().nonnegative(),fatG:z.number().finite().nonnegative()}).strict().optional(),
 sodiumMg:z.number().finite().nonnegative().optional(),
 saltG:z.number().finite().nonnegative().optional(),
 time:time.optional(),
 sourceText:z.string().optional(),
 images:foodImagesSchema.optional(),
 analysis:z.object({response:z.string(),explanation:z.string().optional(),createdAt}).strict().optional(),
 conversation:z.array(z.object({id,role:z.enum(["user","assistant"]),content:z.string(),createdAt,updatedEntry:z.boolean().optional(),response:z.string().optional()}).strict()).optional(),
 userTasteScore:z.number().finite().optional(),
 userTasteNote:z.string().max(500).optional(),
 createdAt,
}).strict();

// Fields from the earlier full version (profile, activity, weight, blood pressure,
// medication, burn-blend settings) are not validated but are kept as-is.
const day=z.looseObject({
 foods:z.array(food),
 trackerBurn:z.number().finite().nullable().default(null),
});

export const backupStateSchema=z.looseObject({
 days:z.record(dateKey,day),
 appliedMutationIds:z.array(z.string().min(1)).optional(),
});

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
