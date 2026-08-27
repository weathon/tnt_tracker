export type Profile = { sex: string; age: number; heightCm: number };
export type FoodEntry = { id: string; name: string; amount: string; energy: number; time?: string; sourceText?: string; tasteScore?: number; userTasteScore?: number; createdAt: string };
export type ActivityEntry = { id: string; name: string; duration: string; time?: string; durationMinutes?: number; met?: number; baseMet?: number; adjustmentPercent?: number; averageHeartRateBpm?: number; heartRateMet?: number; energySource?: "displayed"|"met"|"met_hr_blend"; compendiumCode?: string; metRationale?: string; activeEnergy: number; sourceText: string; createdAt: string };
export type MedicationDefinition = { id: string; name: string; dose: string; createdAt: string };
export type MedicationEntry = { id: string; medicationId?: string; name: string; dose: string; time: string; createdAt: string };
export type WeightEntry = { id: string; weightKg: number; time: string; createdAt: string };
export type Day = { foods: FoodEntry[]; activities: ActivityEntry[]; medications?: MedicationEntry[]; weights?: WeightEntry[]; trackerBurn: number | null; correctionFactor: number; rulerPosition: number };
export type State = { profile: Profile | null; days: Record<string, Day>; medicationList: MedicationDefinition[]; forgottenMedicationIds?: string[] };
