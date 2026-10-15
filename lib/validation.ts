import { z } from "zod";
export const dateSchema = z.string();
export const trackerSchema = z.object({date:dateSchema,trackerBurn:z.number().finite().nonnegative().nullable()});
export const timeSchema = z.string();
