import { z } from "zod";
export const dateSchema = z.string();
export const profileSchema = z.object({sex:z.string(),age:z.number(),heightCm:z.number()});
export const trackerSchema = z.object({date:dateSchema,trackerBurn:z.number().nullable(),correctionFactor:z.number(),rulerPosition:z.number()});
export const timeSchema = z.string();
export const medicationDefinitionSchema = z.object({name:z.string().trim().min(1).max(200),dose:z.string().trim().max(200).default("")});
export const medicationSchema = medicationDefinitionSchema.extend({date:dateSchema,time:timeSchema,medicationId:z.string().optional()});
export const weightSchema = z.object({date:dateSchema,weightKg:z.number(),time:timeSchema});
export const bloodPressureSchema=z.object({date:dateSchema,systolic:z.number().int().min(40).max(300),diastolic:z.number().int().min(20).max(200),time:timeSchema,note:z.string().trim().max(500).optional()}).refine(value=>value.systolic>value.diastolic,{message:"Systolic pressure must be higher than diastolic pressure"});
