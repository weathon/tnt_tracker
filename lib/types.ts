export type FoodEstimateItem = { name: string; grams: number; kcalPer100g: number; energy: number; price?: number; proteinG?: number; carbsG?: number; fatG?: number; sodiumMg?: number; confidence: "high"|"medium"|"low" };
export type FoodMacros = { proteinG: number; carbsG: number; fatG: number };
export type FoodImage = { name: string; url: string };
export type FoodAnalysis = { response: string; explanation?: string; createdAt: string };
export type FoodMessage = { id: string; role: "user"|"assistant"; content: string; createdAt: string; images?: FoodImage[]; updatedEntry?: boolean; response?: string };
export type FoodEntry = { id: string; name: string; amount: string; energy: number; price?: number; items?: FoodEstimateItem[]; energyRange?: [number,number]; macros?: FoodMacros; sodiumMg?: number; saltG?: number; time?: string; sourceText?: string; tasteScore?: number; userTasteScore?: number; userTasteNote?: string; createdAt: string; images?: FoodImage[]; analysis?: FoodAnalysis; conversation?: FoodMessage[] };
// Records written by the earlier full version (profile, activity, weight, blood
// pressure, medication, burn-blend settings) are kept untouched in storage.
export type Day = { foods: FoodEntry[]; trackerBurn: number | null; [legacy: string]: unknown };
export type State = { days: Record<string, Day>; appliedMutationIds?: string[]; [legacy: string]: unknown };
