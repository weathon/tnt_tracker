import { z } from "zod";
export const dateSchema = z.string();
export const profileSchema = z.object({sex:z.string(),age:z.number(),heightCm:z.number()});
export const trackerSchema = z.object({date:dateSchema,trackerBurn:z.number().nullable(),correctionFactor:z.number(),rulerPosition:z.number()});
export const timeSchema = z.string();
export const medicationDefinitionSchema = z.object({name:z.string().trim().min(1).max(200),dose:z.string().trim().max(200).default("")});
export const medicationSchema = medicationDefinitionSchema.extend({date:dateSchema,time:timeSchema,medicationId:z.string().optional()});
export const weightSchema = z.object({date:dateSchema,weightKg:z.number(),time:timeSchema});
