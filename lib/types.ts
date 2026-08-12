export type Sex = "male" | "female";
export type Profile = { sex: Sex; age: number; heightCm: number; weightKg: number };
export type FoodEntry = { id: string; name: string; amount: string; energy: number; time?: string; sourceText?: string; createdAt: string };
export type ActivityEntry = { id: string; name: string; duration: string; durationMinutes?: number; met?: number; baseMet?: number; adjustmentPercent?: number; averageHeartRateBpm?: number; compendiumCode?: string; metRationale?: string; activeEnergy: number; sourceText: string; createdAt: string };
export type MedicationEntry = { id: string; name: string; dose: string; time: string; createdAt: string };
export type Day = { foods: FoodEntry[]; activities: ActivityEntry[]; medications?: MedicationEntry[]; trackerBurn: number | null; correctionFactor: number; rulerPosition: number };
export type State = { profile: Profile | null; days: Record<string, Day> };
