export type Sex = "male" | "female";
export type Profile = { sex: Sex; age: number; heightCm: number; weightKg: number };
export type FoodEntry = { id: string; name: string; amount: string; energy: number; sourceText?: string; createdAt: string };
export type ActivityEntry = { id: string; name: string; duration: string; durationMinutes?: number; met?: number; compendiumCode?: string; activeEnergy: number; sourceText: string; createdAt: string };
export type Day = { foods: FoodEntry[]; activities: ActivityEntry[]; trackerBurn: number | null; correctionFactor: number; rulerPosition: number };
export type State = { profile: Profile | null; days: Record<string, Day> };
