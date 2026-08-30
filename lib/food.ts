import type { FoodEntry } from "./types";

const halfAmount = (amount: string) => `Half of ${amount}`;

export function splitFoodEntry(entry: FoodEntry, newId: string): [FoodEntry, FoodEntry] {
  const firstEnergy = entry.energy / 2;
  const shared = { ...entry, amount: halfAmount(entry.amount) };

  return [
    { ...shared, energy: firstEnergy },
    { ...shared, id: newId, energy: entry.energy - firstEnergy },
  ];
}
