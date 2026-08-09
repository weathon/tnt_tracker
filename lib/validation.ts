import { z } from "zod";
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d=new Date(v+"T00:00:00Z"); return !isNaN(+d) && d.toISOString().slice(0,10)===v; }, "Invalid date");
export const profileSchema = z.object({sex:z.enum(["male","female"]),age:z.number().int().min(13).max(120),heightCm:z.number().min(80).max(260),weightKg:z.number().min(20).max(500)});
export const trackerSchema = z.object({date:dateSchema,trackerBurn:z.number().nonnegative().nullable(),correctionFactor:z.number().min(0).max(5),rulerPosition:z.number().min(0).max(1)});
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");
export const medicationSchema = z.object({date:dateSchema,name:z.string().trim().min(1).max(200),dose:z.string().trim().min(1).max(200),time:timeSchema});
